import { compile } from "../compile.js";
import { collectAttributeNames, scan } from "../scanner.js";
import { transform } from "../transform.js";

const CSS_FILE = /\.css(?:$|\?)/;

/**
 * Vite plugin that compiles attr() v2 into static fallback rules.
 *
 * Deliberately runs without `enforce: "pre"`. Vite inlines `@import` inside its own CSS
 * plugin, so a pre plugin would only ever see the entry stylesheet, before any imported
 * file had been pulled in. Running afterwards means this sees the CSS that will actually
 * ship, however it was assembled.
 *
 * @param {import("../compile.js").CompileOptions & { include?: RegExp }} [options]
 *   `include` decides which module ids to process, defaulting to .css files
 * @returns {import("vite").Plugin}
 */
export function attrPolyfill(options = {}) {
	const {
		include = CSS_FILE,
		mode,
		content = [],
		...compileOptions
	} = options;
	let cwd = process.cwd();

	// Scanning the same content for every stylesheet in a build would be wasteful.
	const scans = new Map();

	return {
		name: "css-attr-polyfill",

		configResolved(config) {
			cwd = config.root ?? cwd;
		},

		async transform(code, id) {
			if (!include.test(id) || !code.includes("attr(")) return null;

			const attributes = [...collectAttributeNames(code)];
			if (attributes.length === 0) return null;

			let result;
			if (content.length) {
				const key = attributes.slice().sort().join(",");
				let pending = scans.get(key);
				if (!pending) {
					pending = scan({ attributes, content, cwd });
					scans.set(key, pending);
				}
				const found = await pending;
				result = transform(code, {
					...compileOptions,
					dynamic: found.dynamic,
					mode: "combined",
					scanned: found.values,
				});
			} else {
				result = await compile(code, {
					...compileOptions,
					cwd,
					mode: "combined",
				});
			}

			for (const warning of result.warnings) this.warn(warning);

			return { code: result.css, map: null };
		},
	};
}

export default attrPolyfill;
