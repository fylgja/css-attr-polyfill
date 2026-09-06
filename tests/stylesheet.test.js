import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
	collectComments,
	detectIndentUnit,
	indentAt,
	parseStylesheet,
	walkRules,
} from "../src/stylesheet.js";

/**
 * @param {string} css
 * @returns {Array<{ selector: string, ancestry: string[], declarations: string[] }>}
 */
function rulesOf(css) {
	const found = [];
	walkRules(parseStylesheet(css), (rule, ancestry) => {
		found.push({
			ancestry: ancestry.map((at) => `@${at.name} ${at.params}`),
			declarations: rule.nodes
				.filter((node) => node.type === "declaration")
				.map((node) => `${node.prop}: ${node.value}`),
			selector: rule.selector,
		});
	});
	return found;
}

describe("parseStylesheet", () => {
	it("reads selectors and declarations", () => {
		assert.deepEqual(rulesOf(".a { color: red; background: blue }"), [
			{
				ancestry: [],
				declarations: ["color: red", "background: blue"],
				selector: ".a",
			},
		]);
	});

	it("tolerates a missing final semicolon", () => {
		assert.deepEqual(rulesOf(".a { color: red }")[0].declarations, [
			"color: red",
		]);
	});

	it("tracks at-rule ancestry", () => {
		const [rule] = rulesOf(
			"@layer u { @media (width >= 768px) { .a { color: red } } }",
		);
		assert.deepEqual(rule.ancestry, [
			"@layer u",
			"@media (width >= 768px)",
		]);
	});

	it("ignores braces and semicolons inside strings", () => {
		const [rule] = rulesOf('.a { content: "x{y;z}"; color: red }');
		assert.deepEqual(rule.declarations, [
			'content: "x{y;z}"',
			"color: red",
		]);
	});

	it("ignores colons and semicolons inside parentheses", () => {
		const [rule] = rulesOf(
			".a { background: url(http://x/y.png); width: calc(1px + 2px) }",
		);
		assert.deepEqual(rule.declarations, [
			"background: url(http://x/y.png)",
			"width: calc(1px + 2px)",
		]);
	});

	it("keeps attr() values intact", () => {
		const [rule] = rulesOf(
			"[a] { width: calc(var(--s) * attr(data-x type(<number>), 1)) }",
		);
		assert.deepEqual(rule.declarations, [
			"width: calc(var(--s) * attr(data-x type(<number>), 1))",
		]);
	});

	it("handles a statement at-rule with no block", () => {
		const rules = rulesOf('@import url("a.css");\n.a { color: red }');
		assert.deepEqual(
			rules.map((rule) => rule.selector),
			[".a"],
		);
	});

	it("does not descend into nested rules", () => {
		const rules = rulesOf(".a { color: red; & .b { color: blue } }");
		assert.deepEqual(
			rules.map((rule) => rule.selector),
			[".a"],
		);
		assert.deepEqual(rules[0].declarations, ["color: red"]);
	});

	it("survives an unbalanced block without hanging", () => {
		assert.doesNotThrow(() => parseStylesheet(".a { color: red"));
	});

	it("keeps custom properties as declarations", () => {
		assert.deepEqual(rulesOf(":root { --x: 1px }")[0].declarations, [
			"--x: 1px",
		]);
	});
});

describe("collectComments", () => {
	it("finds comments at every depth", () => {
		const css = "/* a */ @media print { /* b */ .x { color: red } }";
		assert.deepEqual(collectComments(parseStylesheet(css)), [" a ", " b "]);
	});
});

describe("indentAt and detectIndentUnit", () => {
	it("reports the whitespace a rule sits behind", () => {
		const css = "@media print {\n    .a { color: red }\n}";
		const nodes = parseStylesheet(css);
		assert.equal(indentAt(css, nodes[0].nodes[0].start), "    ");
	});

	it("guesses the stylesheet's indentation", () => {
		const unit = (css) => detectIndentUnit(css, parseStylesheet(css));

		assert.equal(unit("a {\n  color: red\n}"), "  ");
		assert.equal(unit("a {\n\tcolor: red\n}"), "\t");
		assert.equal(unit("a {\n    color: red\n}"), "    ");
		assert.equal(unit("a { color: red }"), "  ");
	});

	it("is not fooled by an aligned block comment above the first rule", () => {
		const css = "/*\n * A banner comment.\n */\na {\n\tcolor: red\n}";
		assert.equal(detectIndentUnit(css, parseStylesheet(css)), "\t");
	});
});

describe("core dependency boundary", () => {
	it("keeps postcss out of everything except the postcss adapter", async () => {
		const dir = fileURLToPath(new URL("../src", import.meta.url));
		const files = await readdir(dir, {
			recursive: true,
			withFileTypes: true,
		});
		const offenders = [];

		for (const file of files) {
			if (!file.isFile() || !file.name.endsWith(".js")) continue;
			const path = `${file.parentPath}/${file.name}`;
			if (path.endsWith("adapters/postcss.js")) continue;

			const source = await readFile(path, "utf8");
			if (/from "postcss"/.test(source)) offenders.push(file.name);
		}

		assert.deepEqual(offenders, []);
	});
});
