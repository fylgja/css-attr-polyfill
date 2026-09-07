export type TransformResult = import("./transform.js").TransformResult;
export type CompileOptions = import("./transform.js").TransformOptions & {
    content?: string[];
    cwd?: string;
};
/**
 * @typedef {import("./transform.js").TransformResult} TransformResult
 */
/**
 * @typedef {import("./transform.js").TransformOptions & {
 *   content?: string[],
 *   cwd?: string,
 * }} CompileOptions every `transform` option, plus content scanning
 */
/**
 * Scan content for attribute values, then compile a stylesheet's attr() calls
 * into static fallbacks.
 *
 * @param {string} css source stylesheet
 * @param {CompileOptions} [options]
 * @returns {Promise<TransformResult & { files: number }>} `files` is how many were scanned
 */
export declare function compile(css: string, options?: CompileOptions): Promise<TransformResult & {
    files: number;
}>;
