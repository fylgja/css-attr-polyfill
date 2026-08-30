import { collectAttributeNames, scan } from "./scanner.js";
import { transform } from "./transform.js";

/**
 * Scan content for attribute values, then compile a stylesheet's attr() calls
 * into static fallbacks.
 *
 * @param {string} css source stylesheet
 * @param {object} [options] every `transform` option, plus the ones below
 * @param {string[]} [options.content] content globs to scan for attribute values
 * @param {string} [options.cwd] base directory for the content globs
 * @returns {Promise<{ css: string, fallback: string | null, warnings: string[], files: number }>}
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
