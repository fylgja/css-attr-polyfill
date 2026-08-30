import { parseAttrRefs, substituteAttr } from "./parse-attr.js";
import { injectAttrValue } from "./selector.js";
import { renderValue } from "./types.js";

/** Generated rules per declaration are capped so a large value set cannot silently explode. */
export const DEFAULT_MAX_VALUES = 250;

/**
 * @typedef {object} GeneratedRule
 * @property {string} selector
 * @property {string} prop
 * @property {string} value
 */

/**
 * @typedef {object} GenerateResult
 * @property {GeneratedRule[]} rules ordered base-first, then one rule per value
 * @property {string[]} warnings
 */

/**
 * Build the static fallback rules for a single declaration containing attr().
 *
 * @param {{ selector: string, prop: string, value: string }} declaration
 * @param {(attribute: string) => Iterable<string>} resolveValues known values per attribute
 * @param {{ maxValues?: number }} [options]
 * @returns {GenerateResult}
 */
export function generateFallbacks(declaration, resolveValues, options = {}) {
	const { selector, prop, value } = declaration;
	const maxValues = options.maxValues ?? DEFAULT_MAX_VALUES;
	const warnings = [];
	const refs = parseAttrRefs(value);

	if (refs.length === 0) return { rules: [], warnings };

	const blocked = refs.find((ref) => ref.unsupported);
	if (blocked) {
		warnings.push(`${prop}: ${blocked.unsupported}, left as-is`);
		return { rules: [], warnings };
	}

	// Two attr() calls in one declaration need co-occurrence data to avoid a cartesian
	// product, which the value-set scanner does not collect.
	if (refs.length > 1) {
		const names = [...new Set(refs.map((ref) => ref.name))].join(", ");
		warnings.push(
			`${prop}: multiple attr() references (${names}) are not supported, left as-is`,
		);
		return { rules: [], warnings };
	}

	const [ref] = refs;
	const rules = [];

	if (ref.fallback !== null) {
		rules.push({ selector, prop, value: substituteAttr(value, 0, ref.fallback) });
	}

	const candidates = [...new Set(resolveValues(ref.name) ?? [])];
	const invalid = [];
	let emitted = 0;

	for (const candidate of candidates) {
		if (emitted >= maxValues) {
			warnings.push(
				`${prop}: ${candidates.length - emitted} value(s) for "${ref.name}" dropped, ` +
					`over the ${maxValues} rule cap`,
			);
			break;
		}

		const substitution = renderValue(candidate, ref.type);
		if (substitution === null) {
			invalid.push(candidate);
			continue;
		}

		rules.push({
			selector: injectAttrValue(selector, ref.name, candidate),
			prop,
			value: substituteAttr(value, 0, substitution),
		});
		emitted++;
	}

	if (invalid.length) {
		warnings.push(
			`${prop}: ${invalid.length} value(s) for "${ref.name}" are not valid ` +
				`(${invalid
					.slice(0, 5)
					.map((v) => JSON.stringify(v))
					.join(", ")}` +
				`${invalid.length > 5 ? ", …" : ""}), falling back to attr()'s own fallback`,
		);
	}

	return { rules, warnings };
}
