import { compile } from "../compile.js";

/**
 * Prepare a stylesheet for Lightning CSS.
 *
 * Lightning CSS parses attr() v2 correctly, but its visitor API models selectors as
 * `SelectorComponent[]` and declarations as structured values, with no escape hatch for
 * raw CSS text. Generated rules therefore cannot be injected from a visitor, so they are
 * produced before Lightning CSS parses the stylesheet.
 *
 * @param {string} css source stylesheet
 * @param {object} [options] every `compile` option
 * @returns {Promise<{ code: string, warnings: string[] }>} feed `code` to lightningcss.transform
 *
 * @example
 * const { code } = await preprocess(source, { content: ["src/**\/*.html"] });
 * lightningcss.transform({ code: Buffer.from(code), filename, minify: true });
 */
export async function preprocess(css, options = {}) {
	const result = await compile(css, { ...options, mode: "combined" });
	return { code: result.css, warnings: result.warnings };
}

export default preprocess;
