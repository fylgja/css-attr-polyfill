import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const BIN = fileURLToPath(new URL("../bin/css-attr-polyfill.js", import.meta.url));

const SPACING = `[data-py] {
	padding-block: calc(var(--spacing) * attr(data-py type(<number>), 1));
}
`;

/**
 * @param {Record<string, string>} files
 * @returns {Promise<string>}
 */
async function fixtureDir(files) {
	const dir = await mkdtemp(join(tmpdir(), "attr-cli-"));
	for (const [name, contents] of Object.entries(files)) {
		await writeFile(join(dir, name), contents);
	}
	return dir;
}

/**
 * @param {string[]} args
 * @param {string} cwd
 * @returns {Promise<{ stdout: string, stderr: string, code: number }>}
 */
async function cli(args, cwd) {
	try {
		const { stdout, stderr } = await run(process.execPath, [BIN, ...args], { cwd });
		return { code: 0, stderr, stdout };
	} catch (error) {
		return { code: error.code, stderr: error.stderr, stdout: error.stdout };
	}
}

describe("cli", () => {
	it("loads a JSON config", async () => {
		// Importing JSON needs an import attribute, so this path must not use import().
		const cwd = await fixtureDir({
			"in.css": SPACING,
			"config.json": JSON.stringify({ safelist: { "data-*": "0..2" } }),
		});
		const { code, stdout, stderr } = await cli(["in.css", "--config", "./config.json"], cwd);

		assert.equal(code, 0, stderr);
		assert.ok(stdout.includes('[data-py="2"]'), stdout);
	});

	it("loads a JS config", async () => {
		const cwd = await fixtureDir({
			"in.css": SPACING,
			"config.mjs": "export default { safelist: { 'data-py': '0..2' } };\n",
		});
		const { code, stdout, stderr } = await cli(["in.css", "--config", "./config.mjs"], cwd);

		assert.equal(code, 0, stderr);
		assert.ok(stdout.includes('[data-py="2"]'), stdout);
	});

	it("reports invalid JSON instead of throwing", async () => {
		const cwd = await fixtureDir({ "in.css": SPACING, "config.json": "{ nope" });
		const { code, stderr } = await cli(["in.css", "--config", "./config.json"], cwd);

		assert.equal(code, 1);
		assert.match(stderr, /not valid JSON/);
	});

	it("reports a missing config file", async () => {
		const cwd = await fixtureDir({ "in.css": SPACING });
		const { code, stderr } = await cli(["in.css", "--config", "./nope.json"], cwd);

		assert.equal(code, 1);
		assert.match(stderr, /cannot read/);
	});

	it("merges safelist flags over the config file", async () => {
		const cwd = await fixtureDir({
			"in.css": SPACING,
			"config.json": JSON.stringify({ safelist: { "data-py": "0..1" } }),
		});
		const { stdout } = await cli(
			["in.css", "--config", "./config.json", "-s", "data-py=9"],
			cwd,
		);

		assert.ok(stdout.includes('[data-py="9"]'));
	});

	it("writes to the output file", async () => {
		const cwd = await fixtureDir({ "in.css": SPACING });
		const { code } = await cli(["in.css", "-s", "data-py=2", "-o", "out.css"], cwd);

		assert.equal(code, 0);
		const out = await readFile(join(cwd, "out.css"), "utf8");
		assert.ok(out.includes("attr(data-py"), "combined output keeps the original rule");
		assert.ok(out.includes('[data-py="2"]'));
	});

	it("writes only the fallback in split mode", async () => {
		const cwd = await fixtureDir({ "in.css": SPACING });
		const { code } = await cli(
			["in.css", "-s", "data-py=2", "--split", "--fallback-out", "fallback.css"],
			cwd,
		);

		assert.equal(code, 0);
		const out = await readFile(join(cwd, "fallback.css"), "utf8");
		assert.ok(!out.includes("attr(data-py"), "split output drops the original rule");
		assert.ok(out.includes('[data-py="2"]'));
	});

	it("requires --fallback-out when splitting", async () => {
		const cwd = await fixtureDir({ "in.css": SPACING });
		const { code, stderr } = await cli(["in.css", "--split"], cwd);

		assert.equal(code, 1);
		assert.match(stderr, /--split requires --fallback-out/);
	});

	it("reports an unreadable input file", async () => {
		const cwd = await fixtureDir({});
		const { code, stderr } = await cli(["nope.css"], cwd);

		assert.equal(code, 1);
		assert.match(stderr, /cannot read/);
	});
});
