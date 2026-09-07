import postcss from "postcss";
import { generateFallbacks } from "../generate.js";
import { createResolver, parseAnnotations } from "../safelist.js";
import { collectAttributeNames, scan } from "../scanner.js";
import { DEFAULT_SUPPORTS_CONDITION } from "../transform.js";

const PLUGIN = "css-attr-polyfill";

/**
 * Build the fallback rules for one PostCSS rule, merging declarations that share a selector.
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

	rule.each((node) => {
		if (node.type !== "decl" || !node.value.includes("attr(")) return;

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
			const declaration = postcss.decl({
				prop: generated.prop,
				value: generated.value,
			});
			declaration.raws = { before: " ", between: ": " };
			declarations.push(declaration);
			bySelector.set(generated.selector, declarations);
		}
	});

	const rules = [...bySelector].map(([selector, declarations]) => {
		const generated = postcss.rule({ selector });
		generated.raws = { after: " ", between: " ", semicolon: false };
		return generated.append(declarations);
	});

	return { rules, warnings };
}

/**
 * PostCSS plugin that compiles attr() v2 into static fallback rules.
 *
 * A PostCSS plugin transforms one stylesheet into one stylesheet, so this always uses
 * combined output. Use the CLI or `compile()` when you want a separate fallback file.
 *
 * @param {import("../compile.js").CompileOptions} [options]
 * @returns {import("postcss").Plugin}
 */
export function attrPolyfill(options = {}) {
	const {
		content = [],
		cwd,
		mode,
		safelist = {},
		annotationMode = "merge",
		supports = DEFAULT_SUPPORTS_CONDITION,
		maxValues,
	} = options;

	// Scanning the same content for every stylesheet in a build would be wasteful.
	const scans = new Map();

	return {
		postcssPlugin: PLUGIN,

		async OnceExit(root, { result }) {
			if (mode === "split") {
				result.warn(
					"split mode is not available in the PostCSS plugin, using combined",
					{
						plugin: PLUGIN,
					},
				);
			}

			let scanned = new Map();
			let dynamic = new Set();
			const attributes = [...collectAttributeNames(root.toString())];

			if (content.length && attributes.length) {
				const key = attributes.slice().sort().join(",");
				let pending = scans.get(key);
				if (!pending) {
					pending = scan({ attributes, content, cwd });
					scans.set(key, pending);
				}
				const found = await pending;
				scanned = found.values;
				dynamic = found.dynamic;
			}

			const comments = [];
			root.walkComments((comment) => comments.push(comment.text));
			const resolve = createResolver({
				annotationMode,
				annotations: parseAnnotations(comments),
				safelist,
				scanned,
			});

			for (const attribute of dynamic) {
				if (resolve(attribute).length === 0) {
					result.warn(
						`"${attribute}" is bound at runtime in your content, so its values ` +
							`cannot be scanned. Add them to the safelist.`,
						{ plugin: PLUGIN },
					);
				}
			}

			/** @type {Array<{ source: import("postcss").Rule, generated: import("postcss").Rule[] }>} */
			const pending = [];

			root.walkRules((rule) => {
				// Nested rules resolve their selector against the parent, which the
				// generator cannot express.
				if (rule.parent?.type === "rule") return;

				const built = buildRulesFor(rule, resolve, { maxValues });
				for (const text of built.warnings)
					result.warn(text, { plugin: PLUGIN });
				if (built.rules.length)
					pending.push({ generated: built.rules, source: rule });
			});

			for (const { source, generated } of pending) {
				const indent =
					/\n([ \t]*)$/.exec(source.raws.before ?? "")?.[1] ?? "";
				const guard = postcss.atRule({
					name: "supports",
					params: supports,
				});
				guard.append(generated);
				guard.raws = {
					after: `\n${indent}`,
					before: `\n${indent}`,
					between: " ",
				};
				for (const rule of guard.nodes)
					rule.raws.before = `\n${indent}  `;
				// After, never before. Browsers without attr() v2 do not reliably drop the
				// declaration at parse time, so an earlier fallback would lose to it.
				source.parent.insertAfter(source, guard);
			}
		},
	};
}

attrPolyfill.postcss = true;

export default attrPolyfill;
