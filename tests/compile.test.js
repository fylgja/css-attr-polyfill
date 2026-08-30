import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { compile } from "../src/compile.js";

const SPACING = `
[data-py] { padding-block: calc(var(--spacing) * attr(data-py type(<number>), 1)); }
[data-px] { padding-inline: calc(var(--spacing) * attr(data-px type(<number>), 1)); }
`;

/**
 * @param {Record<string, string>} files
 * @returns {Promise<string>} directory holding the files
 */
async function fixtureDir(files) {
	const dir = await mkdtemp(join(tmpdir(), "attr-polyfill-"));
	for (const [name, contents] of Object.entries(files)) {
		await writeFile(join(dir, name), contents);
	}
	return dir;
}

describe("compile", () => {
	it("generates rules only for values that appear in content", async () => {
		const cwd = await fixtureDir({
			"index.html": `<div data-py="2"></div><div data-py="5"></div>`,
		});
		const { css } = await compile(SPACING, { content: ["*.html"], cwd });

		assert.ok(css.includes('[data-py="2"]'));
		assert.ok(css.includes('[data-py="5"]'));
		assert.ok(!css.includes('[data-py="3"]'));
	});

	it("scans several content formats in one pass", async () => {
		const cwd = await fixtureDir({
			"Card.jsx": `<div data-py={3} />`,
			"index.html": `<div data-py="2">`,
			"page.php": `<div data-py="<?= $n ?>" data-px="9">`,
		});
		const { css } = await compile(SPACING, { content: ["*.{html,jsx,php}"], cwd });

		assert.ok(css.includes('[data-py="2"]'));
		assert.ok(css.includes('[data-py="3"]'));
		assert.ok(css.includes('[data-px="9"]'));
	});

	it("warns about runtime-bound attributes that nothing else covers", async () => {
		const cwd = await fixtureDir({ "App.vue": `<div :data-py="n" data-px="1">` });
		const { warnings } = await compile(SPACING, { content: ["*.vue"], cwd });

		assert.equal(warnings.length, 1);
		assert.match(warnings[0], /"data-py" is bound at runtime/);
	});

	it("stays quiet when the safelist already covers a bound attribute", async () => {
		const cwd = await fixtureDir({ "App.vue": `<div :data-py="n">` });
		const { css, warnings } = await compile(SPACING, {
			content: ["*.vue"],
			cwd,
			safelist: { "data-py": "0..2" },
		});

		assert.deepEqual(warnings, []);
		assert.ok(css.includes('[data-py="2"]'));
	});

	it("combines scanned values with the safelist", async () => {
		const cwd = await fixtureDir({ "index.html": `<div data-py="7">` });
		const { css } = await compile(SPACING, {
			content: ["*.html"],
			cwd,
			safelist: { "data-py": "0..1" },
		});

		for (const value of ["0", "1", "7"]) {
			assert.ok(css.includes(`[data-py="${value}"]`), value);
		}
	});

	it("skips scanning entirely when no content is configured", async () => {
		const { css, files } = await compile(SPACING, { safelist: { "data-py": "2" } });
		assert.equal(files, 0);
		assert.ok(css.includes('[data-py="2"]'));
	});
});
