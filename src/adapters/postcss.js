import { collectAttributeNames, scan } from "../scanner.js";
import { transformRoot } from "../transform.js";

const PLUGIN = "css-attr-polyfill";

/**
 * PostCSS plugin that compiles attr() v2 into static fallback rules.
 *
 * A PostCSS plugin transforms one stylesheet into one stylesheet, so this always uses
 * combined output. Use the CLI or `compile()` when you want a separate fallback file.
 *
 * @param {object} [options] every `transform` option, plus the ones below
 * @param {string[]} [options.content] content globs to scan for attribute values
 * @param {string} [options.cwd] base directory for the content globs
 * @returns {import("postcss").Plugin}
 */
export function attrPolyfill(options = {}) {
	const { content = [], cwd, mode, ...transformOptions } = options;

	// Scanning the same content for every stylesheet in a build would be wasteful.
	const scans = new Map();

	return {
		postcssPlugin: PLUGIN,

		async OnceExit(root, { result }) {
			if (mode === "split") {
				result.warn("split mode is not available in the PostCSS plugin, using combined", {
					plugin: PLUGIN,
				});
			}

			let scanned = new Map();
			let dynamic = new Set();
			const attributes = [...collectAttributeNames(root.toString())];

			if (content.length && attributes.length) {
				const key = attributes.slice().sort().join(",");
				let pending = scans.get(key);
				if (!pending) {
					pending = scan({ attributes, content, cwd });
					scans.set(key, pending);
				}
				const found = await pending;
				scanned = found.values;
				dynamic = found.dynamic;
			}

			const { warnings } = transformRoot(root, {
				...transformOptions,
				dynamic,
				mode: "combined",
				scanned,
			});

			for (const text of warnings) result.warn(text, { plugin: PLUGIN });
		},
	};
}

attrPolyfill.postcss = true;

export default attrPolyfill;
