/** Generated rules per declaration are capped so a large value set cannot silently explode. */
export declare const DEFAULT_MAX_VALUES = 250;
export type GeneratedRule = {
    selector: string;
    prop: string;
    value: string;
};
export type GenerateResult = {
    /**
     * ordered base-first, then one rule per value
     */
    rules: GeneratedRule[];
    warnings: string[];
};
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
export declare function generateFallbacks(declaration: {
    selector: string;
    prop: string;
    value: string;
}, resolveValues: (attribute: string) => Iterable<string>, options?: {
    maxValues?: number;
}): GenerateResult;
