/**
 * Value sources for attributes that scanning cannot resolve, and for builds that run
 * without scanning at all.
 */
/**
 * Expand a value specification into concrete attribute values.
 *
 * Accepts an array, a `{ from, to, step }` object, a `"0..12 by 0.5"` range string,
 * or a comma-separated list.
 *
 * @param {string[] | number[] | string | { from: number, to: number, step?: number }} spec
 * @returns {string[]}
 */
export declare function expandSpec(spec: string[] | number[] | string | {
    from: number;
    to: number;
    step?: number;
}): string[];
/**
 * Read `attr-polyfill:` annotations out of CSS comment text.
 *
 * @param {string[]} comments raw comment bodies
 * @returns {Map<string, string[]>}
 */
export declare function parseAnnotations(comments: string[]): Map<string, string[]>;
/**
 * Build the value lookup passed to the generator.
 *
 * @param {object} sources
 * @param {Record<string, unknown>} [sources.safelist] config entries, keys may use `*`
 * @param {Map<string, string[]>} [sources.annotations] values found in CSS comments
 * @param {Map<string, Set<string>>} [sources.scanned] values found by the content scanner
 * @param {"merge" | "override"} [sources.annotationMode] how annotations combine with config
 * @returns {(attribute: string) => string[]}
 */
export declare function createResolver({ safelist, annotations, scanned, annotationMode, }?: {
    safelist?: Record<string, unknown>;
    annotations?: Map<string, string[]>;
    scanned?: Map<string, Set<string>>;
    annotationMode?: "merge" | "override";
}): (attribute: string) => string[];
