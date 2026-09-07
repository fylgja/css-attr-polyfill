import { generateFallbacks } from "./generate.js";
import { createResolver, parseAnnotations } from "./safelist.js";
import {
	collectComments,
	detectIndentUnit,
	indentAt,
	parseStylesheet,
	walkRules,
} from "./stylesheet.js";

/**
 * Feature test for attr() v2. Browsers without support fail to parse the value, so the
 * declaration is invalid, the condition is false, and `not` lets the fallback through.
 */
export const DEFAULT_SUPPORTS_CONDITION =
	"not (padding: attr(x type(<length>), 1px))";

/**
 * @typedef {{ selector: string, declarations: Array<{ prop: string, value: string }> }} FallbackRule
 */

/**
 * @param {FallbackRule} rule
 * @returns {string}
 */
function formatRule({ selector, declarations }) {
	const body = declarations
		.map(({ prop, value }) => `${prop}: ${value}`)
		.join("; ");
	return `${selector} { ${body} }`;
}

/**
 * Render an `@supports` block. The caller supplies the leading indentation, so the same
 * output works whether the block is spliced into a document or built into a new one.
 *
 * @param {string} condition
 * @param {FallbackRule[]} rules
 * @param {string} indent
 * @param {string} unit one indentation level
 * @returns {string}
 */
function formatGuard(condition, rules, indent, unit) {
	const body = rules
		.map((rule) => `${indent}${unit}${formatRule(rule)}`)
		.join("\n");
	return `@supports ${condition} {\n${body}\n${indent}}`;
}

/**
 * Build the fallback rules for one style rule, merging declarations that share a selector.
 *
 * @param {import("./stylesheet.js").Rule} rule
 * @param {(attribute: string) => string[]} resolve
 * @param {{ maxValues?: number }} options
 * @returns {{ rules: FallbackRule[], warnings: string[] }}
 */
function buildRulesFor(rule, resolve, options) {
	/** @type {Map<string, Array<{ prop: string, value: string }>>} */
	const bySelector = new Map();
	const warnings = [];

	for (const node of rule.nodes) {
		if (node.type !== "declaration" || !node.value.includes("attr("))
			continue;

		const result = generateFallbacks(
			{ prop: node.prop, selector: rule.selector, value: node.value },
			resolve,
			options,
		);

		warnings.push(
			...result.warnings.map(
				(message) => `${rule.selector} { ${message} }`,
			),
		);

		for (const generated of result.rules) {
			const declarations = bySelector.get(generated.selector) ?? [];
			declarations.push({ prop: generated.prop, value: generated.value });
			bySelector.set(generated.selector, declarations);
		}
	}

	const rules = [...bySelector].map(([selector, declarations]) => ({
		declarations,
		selector,
	}));
	return { rules, warnings };
}

/**
 * Group fallback rules under a tree mirroring their at-rule ancestry, so a shared
 * `@media` or `@layer` is written once.
 *
 * @param {Array<{ ancestry: import("./stylesheet.js").AtRule[], rules: FallbackRule[] }>} entries
 * @returns {{ children: Map<string, any>, name: string, params: string, rules: FallbackRule[] }}
 */
function groupByAncestry(entries) {
	const root = { children: new Map(), name: "", params: "", rules: [] };

	for (const { ancestry, rules } of entries) {
		let node = root;
		for (const atRule of ancestry) {
			const key = `@${atRule.name} ${atRule.params}`;
			let child = node.children.get(key);
			if (!child) {
				child = {
					children: new Map(),
					name: atRule.name,
					params: atRule.params,
					rules: [],
				};
				node.children.set(key, child);
			}
			node = child;
		}
		node.rules.push(...rules);
	}

	return root;
}

/**
 * @param {ReturnType<typeof groupByAncestry>} node
 * @param {string} condition
 * @param {number} depth
 * @returns {string}
 */
function renderGroup(node, condition, depth, unit) {
	const indent = unit.repeat(depth);
	let out = "";

	if (node.rules.length)
		out += `${indent}${formatGuard(condition, node.rules, indent, unit)}\n`;

	for (const child of node.children.values()) {
		out += `${indent}@${child.name} ${child.params} {\n`;
		out += renderGroup(child, condition, depth + 1, unit);
		out += `${indent}}\n`;
	}

	return out;
}

/**
 * @typedef {object} TransformOptions
 * @property {"combined" | "split"} [mode] single document, or source plus a fallback document
 * @property {Record<string, unknown>} [safelist] attribute values, keys may use `*`
 * @property {Map<string, Set<string>>} [scanned] values found by the content scanner
 * @property {Set<string>} [dynamic] attributes the scanner found bound at runtime
 * @property {"merge" | "override"} [annotationMode] how CSS annotations combine with config
 * @property {string} [supports] `@supports` condition guarding the fallback
 * @property {number} [maxValues] cap on generated rules per declaration
 */

/**
 * @typedef {object} TransformResult
 * @property {string} css the source stylesheet, compiled in combined mode or untouched in split
 * @property {string | null} fallback the fallback stylesheet in split mode, otherwise null
 * @property {string[]} warnings
 */

/**
 * Compile attr() v2 declarations in a stylesheet into static fallback rules.
 *
 * Combined mode splices each fallback in immediately after its source rule, so generated
 * CSS keeps that rule's place in the cascade and every untouched byte is preserved exactly.
 * Split mode leaves the source alone and returns a second stylesheet.
 *
 * @param {string} css source stylesheet
 * @param {TransformOptions} [options]
 * @returns {TransformResult}
 */
export function transform(css, options = {}) {
	const {
		mode = "combined",
		safelist = {},
		scanned = new Map(),
		dynamic = new Set(),
		annotationMode = "merge",
		supports = DEFAULT_SUPPORTS_CONDITION,
		maxValues,
	} = options;

	const nodes = parseStylesheet(css);
	const unit = detectIndentUnit(css, nodes);
	const resolve = createResolver({
		annotationMode,
		annotations: parseAnnotations(collectComments(nodes)),
		safelist,
		scanned,
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

	/** @type {Array<{ ancestry: import("./stylesheet.js").AtRule[], rule: import("./stylesheet.js").Rule, rules: FallbackRule[] }>} */
	const pending = [];

	walkRules(nodes, (rule, ancestry) => {
		const built = buildRulesFor(rule, resolve, { maxValues });
		warnings.push(...built.warnings);
		if (built.rules.length)
			pending.push({ ancestry, rule, rules: built.rules });
	});

	if (mode === "split") {
		const grouped = groupByAncestry(pending);
		const fallback = renderGroup(grouped, supports, 0, unit).trim();
		return { css, fallback: fallback ? `${fallback}\n` : "", warnings };
	}

	// The guard goes immediately after its source rule, never before. Browsers without
	// attr() v2 do not reliably drop the declaration at parse time, so a fallback placed
	// earlier would lose to it. Staying adjacent keeps the source rule's position
	// relative to everything else in the stylesheet.
	//
	// Applied back to front so each offset still refers to the original text.
	let out = css;
	for (const { rule, rules } of pending.slice().reverse()) {
		const indent = indentAt(css, rule.start);
		const guard = `\n${indent}${formatGuard(supports, rules, indent, unit)}`;
		out = out.slice(0, rule.end) + guard + out.slice(rule.end);
	}

	return { css: out, fallback: null, warnings };
}
