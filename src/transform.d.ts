/**
 * Feature test for attr() v2. Browsers without support fail to parse the value, so the
 * declaration is invalid, the condition is false, and `not` lets the fallback through.
 */
export declare const DEFAULT_SUPPORTS_CONDITION = "not (padding: attr(x type(<length>), 1px))";
export type FallbackRule = {
    selector: string;
    declarations: Array<{
        prop: string;
        value: string;
    }>;
};
export type TransformOptions = {
    /**
     * single document, or source plus a fallback document
     */
    mode?: "combined" | "split";
    /**
     * attribute values, keys may use `*`
     */
    safelist?: Record<string, unknown>;
    /**
     * values found by the content scanner
     */
    scanned?: Map<string, Set<string>>;
    /**
     * attributes the scanner found bound at runtime
     */
    dynamic?: Set<string>;
    /**
     * how CSS annotations combine with config
     */
    annotationMode?: "merge" | "override";
    /**
     * `@supports` condition guarding the fallback
     */
    supports?: string;
    /**
     * cap on generated rules per declaration
     */
    maxValues?: number;
};
export type TransformResult = {
    /**
     * the source stylesheet, compiled in combined mode or untouched in split
     */
    css: string;
    /**
     * the fallback stylesheet in split mode, otherwise null
     */
    fallback: string | null;
    warnings: string[];
};
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
export declare function transform(css: string, options?: TransformOptions): TransformResult;
