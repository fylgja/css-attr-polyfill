import { compile } from "../compile.js";

const CSS_FILE = /\.css(?:$|\?)/;

/**
 * Vite plugin that compiles attr() v2 into static fallback rules.
 *
 * Runs before Vite's own CSS handling so the generated rules take part in bundling,
 * minification and any downstream PostCSS pipeline.
 *
 * @param {object} [options] every `compile` option
 * @param {string[]} [options.content] content globs to scan for attribute values
 * @param {RegExp} [options.include] which module ids to process, defaults to .css files
 * @returns {import("vite").Plugin}
 */
export function attrPolyfill(options = {}) {
	const { include = CSS_FILE, mode, ...compileOptions } = options;
	let cwd = process.cwd();

	return {
		name: "css-attr-polyfill",
		enforce: "pre",

		configResolved(config) {
			cwd = config.root ?? cwd;
		},

		async transform(code, id) {
			if (!include.test(id) || !code.includes("attr(")) return null;

			const result = await compile(code, {
				cwd,
				...compileOptions,
				from: id,
				mode: "combined",
			});

			for (const warning of result.warnings) this.warn(warning);

			return { code: result.css, map: null };
		},
	};
}

export default attrPolyfill;
