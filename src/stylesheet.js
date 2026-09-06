/**
 * A minimal, dependency free CSS reader.
 *
 * It records source offsets rather than building a document that has to be written back
 * out, so a transform can splice new text in and leave every other byte exactly as the
 * author wrote it. It understands only as much CSS as this package needs: nesting,
 * at-rules, declarations, comments, strings and parentheses.
 */

/**
 * @typedef {object} Declaration
 * @property {"declaration"} type
 * @property {string} prop
 * @property {string} value
 * @property {number} start
 * @property {number} end
 */

/**
 * @typedef {object} Rule
 * @property {"rule"} type
 * @property {string} selector
 * @property {Node[]} nodes
 * @property {number} start offset of the first character of the selector
 * @property {number} end offset just past the closing brace
 */

/**
 * @typedef {object} AtRule
 * @property {"atrule"} type
 * @property {string} name without the leading `@`
 * @property {string} params
 * @property {Node[]} nodes
 * @property {number} start
 * @property {number} end
 */

/**
 * @typedef {object} Comment
 * @property {"comment"} type
 * @property {string} text
 * @property {number} start
 * @property {number} end
 */

/** @typedef {Declaration | Rule | AtRule | Comment} Node */

/**
 * Skip over a construct whose contents must not be scanned for syntax.
 *
 * @param {string} css
 * @param {number} index
 * @returns {number} offset just past the construct, or -1 when index starts something else
 */
function skipAtomic(css, index) {
	const char = css[index];

	if (char === "\\") return index + 2;

	if (char === '"' || char === "'") {
		for (let i = index + 1; i < css.length; i++) {
			if (css[i] === "\\") {
				i++;
				continue;
			}
			if (css[i] === char) return i + 1;
		}
		return css.length;
	}

	if (char === "/" && css[index + 1] === "*") {
		const close = css.indexOf("*/", index + 2);
		return close === -1 ? css.length : close + 2;
	}

	return -1;
}

/**
 * @param {string} css
 * @param {number} open offset of the opening brace
 * @param {number} limit
 * @returns {number} offset of the matching closing brace, or `limit` when unbalanced
 */
function findBlockEnd(css, open, limit) {
	let depth = 0;

	for (let i = open; i < limit; i++) {
		const skip = skipAtomic(css, i);
		if (skip !== -1) {
			i = skip - 1;
			continue;
		}
		if (css[i] === "{") depth++;
		else if (css[i] === "}" && --depth === 0) return i;
	}

	return limit;
}

/**
 * Split a declaration into property and value at the first top level colon.
 *
 * @param {string} text
 * @returns {{ prop: string, value: string } | null}
 */
function splitDeclaration(text) {
	let depth = 0;

	for (let i = 0; i < text.length; i++) {
		const skip = skipAtomic(text, i);
		if (skip !== -1) {
			i = skip - 1;
			continue;
		}
		const char = text[i];
		if (char === "(") depth++;
		else if (char === ")") depth = Math.max(0, depth - 1);
		else if (char === ":" && depth === 0) {
			const prop = text.slice(0, i).trim();
			const value = text.slice(i + 1).trim();
			return prop && value ? { prop, value } : null;
		}
	}

	return null;
}

/**
 * @param {string} css
 * @param {number} from
 * @param {number} to
 * @returns {Node[]}
 */
function parseNodes(css, from, to) {
	const nodes = [];
	let index = from;

	while (index < to) {
		while (index < to && /\s/.test(css[index])) index++;
		if (index >= to) break;

		if (css[index] === "/" && css[index + 1] === "*") {
			const close = css.indexOf("*/", index + 2);
			const end = close === -1 ? to : close + 2;
			nodes.push({
				end,
				start: index,
				text: css.slice(index + 2, end - 2),
				type: "comment",
			});
			index = end;
			continue;
		}

		const start = index;
		let depth = 0;
		let cursor = index;
		let terminator = null;

		while (cursor < to) {
			const skip = skipAtomic(css, cursor);
			if (skip !== -1) {
				cursor = skip;
				continue;
			}
			const char = css[cursor];
			if (char === "(") depth++;
			else if (char === ")") depth = Math.max(0, depth - 1);
			else if (
				depth === 0 &&
				(char === "{" || char === ";" || char === "}")
			) {
				terminator = char;
				break;
			}
			cursor++;
		}

		const prelude = css.slice(start, cursor).trim();

		if (terminator === "{") {
			const blockEnd = findBlockEnd(css, cursor, to);
			const children = parseNodes(css, cursor + 1, blockEnd);
			const end = Math.min(blockEnd + 1, to);

			if (prelude.startsWith("@")) {
				const match = /^@([\w-]+)\s*/.exec(prelude);
				nodes.push({
					end,
					name: match?.[1] ?? "",
					nodes: children,
					params: prelude.slice(match?.[0].length ?? 1).trim(),
					start,
					type: "atrule",
				});
			} else {
				nodes.push({
					end,
					nodes: children,
					selector: prelude,
					start,
					type: "rule",
				});
			}

			index = end;
			continue;
		}

		// A statement at-rule such as `@import url(...);` has no block to descend into.
		if (prelude.startsWith("@")) {
			const match = /^@([\w-]+)\s*/.exec(prelude);
			const end = terminator === ";" ? cursor + 1 : cursor;
			nodes.push({
				end,
				name: match?.[1] ?? "",
				nodes: [],
				params: prelude.slice(match?.[0].length ?? 1).trim(),
				start,
				type: "atrule",
			});
			index = end;
			continue;
		}

		const declaration = prelude ? splitDeclaration(prelude) : null;
		if (declaration) {
			nodes.push({
				...declaration,
				end: cursor,
				start,
				type: "declaration",
			});
		}

		if (terminator === "}") {
			index = cursor;
			break;
		}
		index = terminator === ";" ? cursor + 1 : cursor;
	}

	return nodes;
}

/**
 * Read a stylesheet into nodes carrying source offsets.
 *
 * @param {string} css
 * @returns {Node[]}
 */
export function parseStylesheet(css) {
	return parseNodes(css, 0, css.length);
}

/**
 * Visit every style rule, deepest ancestry first, passing the at-rules enclosing it.
 *
 * @param {Node[]} nodes
 * @param {(rule: Rule, ancestry: AtRule[]) => void} visit
 * @param {AtRule[]} [ancestry]
 */
export function walkRules(nodes, visit, ancestry = []) {
	for (const node of nodes) {
		if (node.type === "atrule") {
			walkRules(node.nodes, visit, [...ancestry, node]);
		} else if (node.type === "rule") {
			visit(node, ancestry);
			// Nested rules resolve their selector against the parent, which the generator
			// cannot express, so they are visited but never descended into.
		}
	}
}

/**
 * Collect every comment in a stylesheet, at any depth.
 *
 * @param {Node[]} nodes
 * @returns {string[]}
 */
export function collectComments(nodes) {
	const comments = [];

	for (const node of nodes) {
		if (node.type === "comment") comments.push(node.text);
		else if (node.nodes) comments.push(...collectComments(node.nodes));
	}

	return comments;
}

/**
 * The whitespace a node sits behind on its own line, used to indent generated output.
 *
 * @param {string} css
 * @param {number} start
 * @returns {string}
 */
export function indentAt(css, start) {
	const lineStart = css.lastIndexOf("\n", start - 1) + 1;
	const prefix = css.slice(lineStart, start);
	return /^[ \t]*$/.test(prefix) ? prefix : "";
}

/**
 * Guess the indentation a stylesheet uses, so generated rules match the file they join.
 *
 * Measured from the first declaration that sits inside a rule, rather than from raw text,
 * so an aligned block comment cannot be mistaken for the file's indentation.
 *
 * @param {string} css
 * @param {Node[]} nodes the same stylesheet, already parsed
 * @returns {string} one indentation level, defaulting to two spaces
 */
export function detectIndentUnit(css, nodes) {
	let unit = null;

	walkRules(nodes, (rule) => {
		if (unit) return;

		const declaration = rule.nodes.find(
			(node) => node.type === "declaration",
		);
		if (!declaration) return;

		const outer = indentAt(css, rule.start);
		const inner = indentAt(css, declaration.start);
		if (inner.startsWith(outer) && inner.length > outer.length)
			unit = inner.slice(outer.length);
	});

	return unit ?? "  ";
}
