import parser from "postcss-selector-parser";

const LEGACY_PSEUDO_ELEMENTS = new Set([
	":before",
	":after",
	":first-line",
	":first-letter",
]);

/** Pseudo-classes that match the same element as their host compound. */
const TRANSPARENT_PSEUDOS = new Set([":where", ":is"]);

/**
 * @param {import("postcss-selector-parser").Node} node
 * @returns {boolean}
 */
function isPseudoElement(node) {
	if (node.type !== "pseudo") return false;
	return (
		node.value.startsWith("::") ||
		LEGACY_PSEUDO_ELEMENTS.has(node.value.toLowerCase())
	);
}

/**
 * Build a detached node by parsing it, which avoids the quoteMark API on constructed nodes.
 *
 * @param {string} source
 * @returns {import("postcss-selector-parser").Node}
 */
function nodeFrom(source) {
	return parser().astSync(source).first.first;
}

/**
 * @param {string} value
 * @returns {string}
 */
function quoteSelectorValue(value) {
	return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/**
 * Index of the first node belonging to the selector's subject compound.
 *
 * attr() always resolves against the element the declaration applies to, so only the
 * subject compound may be narrowed. Narrowing an ancestor would match different elements.
 *
 * @param {import("postcss-selector-parser").Selector} selector
 * @returns {number}
 */
function subjectStart(selector) {
	for (let i = selector.nodes.length - 1; i >= 0; i--) {
		if (selector.nodes[i].type === "combinator") return i + 1;
	}
	return 0;
}

/**
 * Find a bare `[attribute]` in the subject that can be narrowed in place without
 * changing specificity or which elements match.
 *
 * @param {import("postcss-selector-parser").Node[]} subject
 * @param {string} attribute
 * @returns {import("postcss-selector-parser").Node | null}
 */
function findRewritable(subject, attribute) {
	const isBare = (node) =>
		node.type === "attribute" &&
		node.attribute === attribute &&
		!node.operator;

	const direct = subject.filter(isBare);
	if (direct.length === 1) return direct[0];
	if (direct.length > 1) return null;

	// `:where([data-py])` and `:is([data-py])` match the host element, so narrowing the
	// attribute inside a single-branch, single-node wrapper is equivalent and keeps
	// the wrapper's specificity behaviour.
	const wrapped = subject.filter(
		(node) =>
			node.type === "pseudo" &&
			TRANSPARENT_PSEUDOS.has(node.value.toLowerCase()) &&
			node.nodes.length === 1 &&
			node.nodes[0].nodes.length === 1 &&
			isBare(node.nodes[0].nodes[0]),
	);
	return wrapped.length === 1 ? wrapped[0].nodes[0].nodes[0] : null;
}

/**
 * Narrow a selector so it only matches elements carrying a specific attribute value.
 *
 * Rewrites an existing bare attribute selector where possible. Otherwise appends
 * `:where([attr="value"])`, which adds no specificity, before any pseudo-element.
 *
 * @param {string} selector source selector text
 * @param {string} attribute attribute name
 * @param {string} value attribute value to match
 * @returns {string}
 */
export function injectAttrValue(selector, attribute, value) {
	const match = `[${attribute}=${quoteSelectorValue(value)}]`;

	return parser((root) => {
		root.each((branch) => {
			const start = subjectStart(branch);
			const subject = branch.nodes.slice(start);

			const rewritable = findRewritable(subject, attribute);
			if (rewritable) {
				rewritable.replaceWith(nodeFrom(match));
				return;
			}

			const guard = nodeFrom(`:where(${match})`);
			const pseudoElement = subject.find(isPseudoElement);
			if (pseudoElement) branch.insertBefore(pseudoElement, guard);
			else branch.append(guard);
		});
	}).processSync(selector);
}
