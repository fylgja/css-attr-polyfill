import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import postcss from "postcss";
import { attrPolyfill as postcssAttrPolyfill } from "../src/adapters/postcss.js";
import { preprocess } from "../src/adapters/lightningcss.js";
import { attrPolyfill as viteAttrPolyfill } from "../src/adapters/vite.js";

const SPACING =
	"[data-py] { padding-block: calc(var(--spacing) * attr(data-py type(<number>), 1)); }";

/**
 * @param {Record<string, string>} files
 * @returns {Promise<string>}
 */
async function fixtureDir(files) {
	const dir = await mkdtemp(join(tmpdir(), "attr-adapters-"));
	for (const [name, contents] of Object.entries(files)) {
		await writeFile(join(dir, name), contents);
	}
	return dir;
}

describe("postcss plugin", () => {
	it("generates fallbacks from a safelist", async () => {
		const result = await postcss([
			postcssAttrPolyfill({ safelist: { "data-py": "0..2" } }),
		]).process(SPACING, { from: undefined });

		assert.ok(result.css.includes('[data-py="2"] { padding-block: calc(var(--spacing) * 2) }'));
		assert.ok(result.css.includes("attr(data-py type(<number>), 1)"));
	});

	it("scans content when globs are configured", async () => {
		const cwd = await fixtureDir({ "index.html": `<div data-py="7">` });
		const result = await postcss([postcssAttrPolyfill({ content: ["*.html"], cwd })]).process(
			SPACING,
			{ from: undefined },
		);

		assert.ok(result.css.includes('[data-py="7"]'));
	});

	it("surfaces warnings through the PostCSS result", async () => {
		const cwd = await fixtureDir({ "App.vue": `<div :data-py="n">` });
		const result = await postcss([postcssAttrPolyfill({ content: ["*.vue"], cwd })]).process(
			SPACING,
			{ from: undefined },
		);

		const messages = result.warnings().map((warning) => warning.text);
		assert.ok(messages.some((text) => /bound at runtime/.test(text)));
	});

	it("says so when asked for split mode it cannot provide", async () => {
		const result = await postcss([
			postcssAttrPolyfill({ mode: "split", safelist: { "data-py": "1" } }),
		]).process(SPACING, { from: undefined });

		assert.ok(
			result.warnings().some((warning) => /split mode is not available/.test(warning.text)),
		);
		assert.ok(result.css.includes('[data-py="1"]'));
	});

	it("leaves stylesheets without attr() untouched", async () => {
		const source = ".x { color: red; }";
		const result = await postcss([
			postcssAttrPolyfill({ safelist: { "data-py": "1" } }),
		]).process(source, { from: undefined });

		assert.equal(result.css, source);
	});
});

describe("lightningcss preprocessor", () => {
	it("returns code ready to hand to lightningcss.transform", async () => {
		const { code } = await preprocess(SPACING, { safelist: { "data-py": "2" } });

		assert.ok(code.includes('[data-py="2"]'));
		assert.ok(code.includes("@supports not"));
	});
});

describe("vite plugin", () => {
	it("only touches css modules that contain attr()", async () => {
		const plugin = viteAttrPolyfill({ safelist: { "data-py": "2" } });
		const context = { warn() {} };

		assert.equal(await plugin.transform.call(context, SPACING, "/app/main.js"), null);
		assert.equal(await plugin.transform.call(context, ".x { color: red }", "/app/a.css"), null);

		const result = await plugin.transform.call(context, SPACING, "/app/a.css");
		assert.ok(result.code.includes('[data-py="2"]'));
	});

	it("handles ids carrying a query string", async () => {
		const plugin = viteAttrPolyfill({ safelist: { "data-py": "2" } });
		const result = await plugin.transform.call({ warn() {} }, SPACING, "/app/a.css?used");

		assert.ok(result.code.includes('[data-py="2"]'));
	});

	it("reports warnings through the Rollup context", async () => {
		const plugin = viteAttrPolyfill({});
		const warnings = [];
		const source =
			"[data-a] { margin: attr(data-a type(<number>)) attr(data-b type(<number>)); }";

		await plugin.transform.call({ warn: (text) => warnings.push(text) }, source, "/app/a.css");

		assert.ok(warnings.some((text) => /multiple attr\(\) references/.test(text)));
	});
});
