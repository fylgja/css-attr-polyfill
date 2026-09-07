import { collectAttributeNames, scan } from "./scanner.js";
import { transform } from "./transform.js";

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
export async function compile(css, options = {}) {
	const { content = [], cwd, ...transformOptions } = options;

	if (content.length === 0) {
		return { ...transform(css, transformOptions), files: 0 };
	}

	const attributes = collectAttributeNames(css);
	const scanned = await scan({ attributes, content, cwd });
	const result = transform(css, {
		...transformOptions,
		dynamic: scanned.dynamic,
		scanned: scanned.values,
	});

	return { ...result, files: scanned.files };
}
