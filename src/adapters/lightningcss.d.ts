/**
 * Prepare a stylesheet for Lightning CSS.
 *
 * Lightning CSS parses attr() v2 correctly, but its visitor API models selectors as
 * `SelectorComponent[]` and declarations as structured values, with no escape hatch for
 * raw CSS text. Generated rules therefore cannot be injected from a visitor, so they are
 * produced before Lightning CSS parses the stylesheet.
 *
 * @param {string} css source stylesheet
 * @param {import("../compile.js").CompileOptions} [options]
 * @returns {Promise<{ code: string, warnings: string[] }>} feed `code` to lightningcss.transform
 *
 * @example
 * const { code } = await preprocess(source, { content: ["src/**\/*.html"] });
 * lightningcss.transform({ code: Buffer.from(code), filename, minify: true });
 */
export declare function preprocess(css: string, options?: import("../compile.js").CompileOptions): Promise<{
    code: string;
    warnings: string[];
}>;
export default preprocess;
