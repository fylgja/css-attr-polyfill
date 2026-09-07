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
export declare function injectAttrValue(selector: string, attribute: string, value: string): string;
