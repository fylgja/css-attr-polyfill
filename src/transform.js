import postcss from "postcss";
import { generateFallbacks } from "./generate.js";
import { createResolver, parseAnnotations } from "./safelist.js";

/**
 * Feature test for attr() v2. Browsers without support fail to parse the value, so the
 * declaration is invalid, the condition is false, and `not` lets the fallback through.
 */
export const DEFAULT_SUPPORTS_CONDITION = "not (padding: attr(x type(<length>), 1px))";

/**
 * @param {import("postcss").Node} node
 * @returns {import("postcss").AtRule[]} at-rule ancestors, outermost first
 */
function atRuleAncestors(node) {
	const chain = [];
	for (let parent = node.parent; parent && parent.type !== "root"; parent = parent.parent) {
		if (parent.type === "atrule") chain.unshift(parent);
	}
	return chain;
}

/**
 * Recreate a node's at-rule ancestry inside the fallback document, reusing containers
 * so consecutive rules do not each get their own `@media`.
 *
 * @param {import("postcss").Root} root
 * @param {import("postcss").Rule} source
 * @param {Map<string, import("postcss").Container>} cache
 * @returns {import("postcss").Container}
 */
function mirrorAncestry(root, source, cache) {
	let container = root;
	let key = "";

	for (const ancestor of atRuleAncestors(source)) {
		key += `@${ancestor.name} ${ancestor.params} `;
		let next = cache.get(key);
		if (!next) {
			next = postcss.atRule({ name: ancestor.name, params: ancestor.params });
			container.append(next);
			cache.set(key, next);
		}
		container = next;
	}

	return container;
}

/**
 * Format a generated `@supports` block so it sits at the same indentation as its neighbours.
 *
 * @param {import("postcss").AtRule} guard
 * @param {string} indent leading whitespace of the surrounding rules
 */
function formatGuard(guard, indent, before) {
	guard.raws = { after: `\n${indent}`, before, between: " " };
	for (const rule of guard.nodes) rule.raws.before = `\n${indent}  `;
}

/**
 * @param {import("postcss").Rule} rule
 * @returns {string} the rule's own indentation, taken from its source formatting
 */
function indentOf(rule) {
	return /\n([ \t]*)$/.exec(rule.raws.before ?? "")?.[1] ?? "";
}

/**
 * Collect the generated rules for one source rule, merging declarations that share a selector.
 *
 * @param {import("postcss").Rule} rule
 * @param {(attribute: string) => string[]} resolve
 * @param {{ maxValues?: number }} options
 * @returns {{ rules: import("postcss").Rule[], warnings: string[] }}
 */
function buildRulesFor(rule, resolve, options) {
	/** @type {Map<string, import("postcss").Declaration[]>} */
	const bySelector = new Map();
	const warnings = [];

	rule.walkDecls((decl) => {
		if (!decl.value.includes("attr(")) return;

		const result = generateFallbacks(
			{ selector: rule.selector, prop: decl.prop, value: decl.value },
			resolve,
			options,
		);

		warnings.push(...result.warnings.map((message) => `${rule.selector} { ${message} }`));

		for (const generated of result.rules) {
			const declarations = bySelector.get(generated.selector) ?? [];
			const declaration = postcss.decl({ prop: generated.prop, value: generated.value });
			// Explicit raws keep generated output identical regardless of how the
			// source rule happened to be formatted.
			declaration.raws = { before: " ", between: ": " };
			declarations.push(declaration);
			bySelector.set(generated.selector, declarations);
		}
	});

	const rules = [...bySelector].map(([selector, declarations]) => {
		const rule = postcss.rule({ selector });
		rule.raws = { after: " ", between: " ", semicolon: false };
		return rule.append(declarations);
	});

	return { rules, warnings };
}

/**
 * Compile attr() v2 declarations into static fallback rules, mutating the document in place.
 *
 * Use this from a PostCSS plugin, where the Root already exists. Use `transform` when you
 * only have CSS text.
 *
 * @param {import("postcss").Root} root parsed stylesheet, modified in place
 * @param {object} [options]
 * @param {"combined" | "split"} [options.mode] single document, or source plus a fallback document
 * @param {Record<string, unknown>} [options.safelist] attribute values, keys may use `*`
 * @param {Map<string, Set<string>>} [options.scanned] values found by the content scanner
 * @param {Set<string>} [options.dynamic] attributes the scanner found bound at runtime
 * @param {"merge" | "override"} [options.annotationMode] how CSS annotations combine with config
 * @param {string} [options.supports] `@supports` condition guarding the fallback
 * @param {number} [options.maxValues] cap on generated rules per declaration
 * @returns {{ root: import("postcss").Root, fallback: import("postcss").Root | null, warnings: string[] }}
 */
export function transformRoot(root, options = {}) {
	const {
		mode = "combined",
		safelist = {},
		scanned = new Map(),
		dynamic = new Set(),
		annotationMode = "merge",
		supports = DEFAULT_SUPPORTS_CONDITION,
		maxValues,
	} = options;

	const comments = [];
	root.walkComments((comment) => comments.push(comment.text));
	const resolve = createResolver({
		safelist,
		annotations: parseAnnotations(comments),
		scanned,
		annotationMode,
	});

	const warnings = [];

	// Only worth reporting when nothing else supplies the attribute's values.
	for (const attribute of dynamic) {
		if (resolve(attribute).length === 0) {
			warnings.push(
				`"${attribute}" is bound at runtime in your content, so its values cannot be ` +
					`scanned. Add them to the safelist.`,
			);
		}
	}

	/** @type {Array<{ source: import("postcss").Rule, generated: import("postcss").Rule[] }>} */
	const pending = [];

	root.walkRules((rule) => {
		// Nested rules inside another rule would need their selector resolved first.
		if (rule.parent?.type === "rule") return;

		const built = buildRulesFor(rule, resolve, { maxValues });
		warnings.push(...built.warnings);
		if (built.rules.length) pending.push({ generated: built.rules, source: rule });
	});

	if (!pending.length) {
		return { fallback: mode === "split" ? postcss.root() : null, root, warnings };
	}

	if (mode === "split") {
		const fallbackRoot = postcss.root();
		const cache = new Map();

		// One guard per container, so sibling rules share a single @supports block.
		const guards = new Map();

		for (const { source, generated } of pending) {
			const container = mirrorAncestry(fallbackRoot, source, cache);
			let guard = guards.get(container);
			if (!guard) {
				guard = postcss.atRule({ name: "supports", params: supports });
				container.append(guard);
				guards.set(container, guard);
			}
			const indent = "  ".repeat(atRuleAncestors(source).length);
			guard.append(generated);
			formatGuard(guard, indent, `\n${indent}`);
		}

		return { fallback: fallbackRoot, root, warnings };
	}

	// Inserted immediately before the source rule so the fallback keeps the source's
	// position in the cascade rather than jumping to the end of the file.
	for (const { source, generated } of pending) {
		const guard = postcss.atRule({ name: "supports", params: supports });
		const indent = indentOf(source);
		guard.append(generated);
		// The guard takes over the source rule's original spacing, so inserting it
		// never introduces a stray blank line at the top of the file.
		formatGuard(guard, indent, source.raws.before ?? "");
		source.raws.before = `\n${indent}`;
		source.parent.insertBefore(source, guard);
	}

	return { fallback: null, root, warnings };
}

/**
 * Compile attr() v2 declarations in a stylesheet's source text.
 *
 * @param {string} css source stylesheet
 * @param {Parameters<typeof transformRoot>[1] & { from?: string }} [options]
 * @returns {{ css: string, fallback: string | null, warnings: string[] }}
 */
export function transform(css, options = {}) {
	const { from, ...rest } = options;
	const result = transformRoot(postcss.parse(css, { from }), rest);

	return {
		css: result.root.toString(),
		fallback: result.fallback ? `${result.fallback.toString().trim()}\n` : null,
		warnings: result.warnings,
	};
}
