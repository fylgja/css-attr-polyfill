/**
 * Type validation and rendering for CSS attr() v2 substitution values.
 *
 * A scanned attribute value only earns a generated rule if it actually parses as the
 * declared type. Native attr() falls back to its fallback argument otherwise, so emitting
 * a rule for an unparseable value would diverge from browser behaviour.
 */
/**
 * Escape a value for use inside a double-quoted CSS string.
 *
 * @param {string} value
 * @returns {string}
 */
export declare function quoteString(value: string): string;
/**
 * Whether a `type()` syntax string is supported.
 *
 * @param {string} syntax
 * @returns {boolean}
 */
export declare function isKnownSyntax(syntax: string): boolean;
/**
 * Whether an identifier is usable as an `<attr-unit>`.
 *
 * @param {string} unit
 * @returns {boolean}
 */
export declare function isAttrUnit(unit: string): boolean;
/**
 * Render an attribute value as the CSS token sequence attr() would substitute.
 *
 * @param {string} value raw attribute value from markup or a safelist
 * @param {import("./parse-attr.js").AttrType} type
 * @returns {string | null} substitution text, or null when the value is invalid for the type
 */
export declare function renderValue(value: string, type: import("./parse-attr.js").AttrType): string | null;
