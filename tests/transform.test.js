import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import postcss from "postcss";
import { DEFAULT_SUPPORTS_CONDITION, transform } from "../src/transform.js";

const fixture = (name) =>
	readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), "utf8");

const SPACING =
	"[data-py] { padding-block: calc(var(--spacing) * attr(data-py type(<number>), 1)); }";

describe("transform", () => {
	it("leaves stylesheets without attr() alone", () => {
		const source = ".x { color: red; }";
		const result = transform(source, { safelist: { "data-py": "0..2" } });
		assert.equal(result.css, source);
		assert.equal(result.fallback, null);
	});

	it("guards generated rules behind a @supports the old browsers pass", () => {
		const { css } = transform(SPACING, { safelist: { "data-py": "0..1" } });
		assert.ok(css.includes(`@supports ${DEFAULT_SUPPORTS_CONDITION}`));
		assert.ok(css.includes('[data-py="1"] { padding-block: calc(var(--spacing) * 1) }'));
	});

	it("keeps the original attr() declaration untouched", () => {
		const { css } = transform(SPACING, { safelist: { "data-py": "0..1" } });
		assert.ok(css.includes("attr(data-py type(<number>), 1)"));
	});

	it("puts the fallback before its source rule, holding the source's cascade position", () => {
		const source = `${SPACING}\n.override { padding-block: 0; }`;
		const { css } = transform(source, { safelist: { "data-py": "0..2" } });
		assert.ok(
			css.indexOf('[data-py="2"]') < css.indexOf(".override"),
			"generated rules must not jump past later rules in the file",
		);
	});

	it("mirrors @media and @layer ancestry in split mode", () => {
		const source = `@layer utils {\n  @media (width >= 768px) {\n    ${SPACING}\n  }\n}`;
		const { fallback } = transform(source, { mode: "split", safelist: { "data-py": "0..1" } });
		const root = postcss.parse(fallback);
		const layer = root.first;
		assert.equal(layer.name, "layer");
		assert.equal(layer.first.name, "media");
		// @supports sits innermost so the @layer name still registers.
		assert.equal(layer.first.first.name, "supports");
	});

	it("leaves the source document unchanged in split mode", () => {
		const { css, fallback } = transform(SPACING, {
			mode: "split",
			safelist: { "data-py": "0..1" },
		});
		assert.equal(css, SPACING);
		assert.ok(fallback.includes('[data-py="1"]'));
	});

	it("coalesces sibling rules into one @supports block in split mode", () => {
		const source = `${SPACING}\n[data-px] { padding-inline: calc(var(--spacing) * attr(data-px type(<number>), 1)); }`;
		const { fallback } = transform(source, { mode: "split", safelist: { "data-*": "0..1" } });
		const guards = [];
		postcss.parse(fallback).walkAtRules("supports", (node) => guards.push(node));
		assert.equal(guards.length, 1);
	});

	it("merges declarations that share a generated selector", () => {
		const source = `[data-size] {
            block-size: calc(var(--spacing) * attr(data-size type(<number>), 1));
            inline-size: calc(var(--spacing) * attr(data-size type(<number>), 1));
        }`;
		const { css } = transform(source, { safelist: { "data-size": "2" } });
		assert.ok(
			css.includes(
				'[data-size="2"] { block-size: calc(var(--spacing) * 2); inline-size: calc(var(--spacing) * 2) }',
			),
		);
	});

	it("reads values from an in-CSS annotation", () => {
		const source = `/* attr-polyfill: anchor --tip, --menu */\n[anchor] { anchor-name: attr(anchor type(<custom-ident>)); }`;
		const { css } = transform(source);
		assert.ok(css.includes('[anchor="--tip"] { anchor-name: --tip }'));
		assert.ok(css.includes('[anchor="--menu"] { anchor-name: --menu }'));
	});

	it("accepts scanned values alongside the safelist", () => {
		const { css } = transform(SPACING, {
			safelist: { "data-py": "0..1" },
			scanned: new Map([["data-py", new Set(["7"])]]),
		});
		assert.ok(css.includes('[data-py="7"]'));
	});

	it("produces output that parses back cleanly", () => {
		const { css } = transform(fixture("spacing.css"), { safelist: { "data-*": "0..4" } });
		assert.doesNotThrow(() => postcss.parse(css));
	});
});

describe("fixtures", () => {
	it("compiles the whole experimental spacing utility", () => {
		const { css, warnings } = transform(fixture("spacing.css"), {
			safelist: { "data-*": "0..4 by 0.5" },
		});
		assert.deepEqual(warnings, []);
		assert.ok(css.includes('[data-py="2"] { padding-block: calc(var(--spacing) * 2) }'));
		assert.ok(css.includes('[data-py="0.5"] { padding-block: calc(var(--spacing) * 0.5) }'));
		// Breakpoint variants stay inside their own media query.
		const media = postcss
			.parse(css)
			.nodes.find((node) => node.type === "atrule" && node.params.includes("1024px"));
		assert.ok(media.toString().includes('[data-lg-py="2"]'));
	});

	it("compiles the anchor utility, which has no attr() fallback", () => {
		const { css, warnings } = transform(fixture("anchor.css"), {
			safelist: { anchor: "--tip", anchortarget: "--tip" },
		});
		assert.deepEqual(warnings, []);
		assert.ok(css.includes('[anchor="--tip"] { anchor-name: --tip }'));
		assert.ok(css.includes('[anchortarget="--tip"] { position-anchor: --tip }'));
		// position-area and position-try carry no attr(), so they are not duplicated.
		assert.ok(
			!css.includes(
				'@supports not (padding: attr(x type(<length>), 1px)) {\n    [anchortarget="--tip"] { position-anchor: --tip; position-area: bottom',
			),
		);
	});
});
