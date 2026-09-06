import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	isAttrUnit,
	isKnownSyntax,
	quoteString,
	renderValue,
} from "../src/types.js";

const syntax = (s) => ({ kind: "syntax", syntax: s });

describe("renderValue", () => {
	it("accepts values that parse as the declared type", () => {
		assert.equal(renderValue("2", syntax("<number>")), "2");
		assert.equal(renderValue("0.5", syntax("<number>")), "0.5");
		assert.equal(renderValue("-3e2", syntax("<number>")), "-3e2");
		assert.equal(renderValue("10px", syntax("<length>")), "10px");
		assert.equal(renderValue("50%", syntax("<percentage>")), "50%");
		assert.equal(renderValue("90deg", syntax("<angle>")), "90deg");
		assert.equal(renderValue("--tip", syntax("<custom-ident>")), "--tip");
		assert.equal(renderValue("#fff", syntax("<color>")), "#fff");
		assert.equal(
			renderValue("oklch(50% 0 0)", syntax("<color>")),
			"oklch(50% 0 0)",
		);
	});

	it("accepts every CSS named colour, not a hand-picked subset", () => {
		for (const name of [
			"rebeccapurple",
			"cornflowerblue",
			"lightgoldenrodyellow",
			"peru",
		]) {
			assert.equal(renderValue(name, syntax("<color>")), name);
		}
	});

	it("rejects values that do not, so attr()'s own fallback applies instead", () => {
		assert.equal(renderValue("abc", syntax("<number>")), null);
		assert.equal(renderValue("2", syntax("<length>")), null);
		assert.equal(renderValue("10", syntax("<percentage>")), null);
		assert.equal(renderValue("notacolour", syntax("<color>")), null);
	});

	it("treats a unitless zero as a length but not as an angle or time", () => {
		assert.equal(renderValue("0", syntax("<length>")), "0");
		assert.equal(renderValue("0", syntax("<angle>")), null);
		assert.equal(renderValue("0", syntax("<time>")), null);
	});

	it("rejects CSS-wide keywords as custom idents", () => {
		for (const keyword of [
			"initial",
			"inherit",
			"unset",
			"revert",
			"REVERT-LAYER",
		]) {
			assert.equal(
				renderValue(keyword, syntax("<custom-ident>")),
				null,
				keyword,
			);
		}
	});

	it("rejects idents that cannot start an identifier", () => {
		assert.equal(renderValue("1foo", syntax("<custom-ident>")), null);
		assert.equal(renderValue("-2foo", syntax("<custom-ident>")), null);
	});

	it("quotes string types and wraps urls", () => {
		assert.equal(renderValue("hi", { kind: "string" }), '"hi"');
		assert.equal(renderValue("hi", { kind: "raw-string" }), '"hi"');
		assert.equal(renderValue("a/b.png", syntax("<url>")), 'url("a/b.png")');
	});

	it("appends the declared attr-unit to a bare number", () => {
		assert.equal(renderValue("3", { kind: "unit", unit: "px" }), "3px");
		assert.equal(renderValue("3", { kind: "unit", unit: "%" }), "3%");
		assert.equal(renderValue("3px", { kind: "unit", unit: "px" }), null);
	});
});

describe("quoteString", () => {
	it("escapes backslashes and double quotes", () => {
		assert.equal(quoteString('he said "hi"'), '"he said \\"hi\\""');
		assert.equal(quoteString("a\\b"), '"a\\\\b"');
	});
});

describe("syntax and unit lookups", () => {
	it("recognises supported syntaxes and units", () => {
		assert.ok(isKnownSyntax("<number>"));
		assert.ok(!isKnownSyntax("<weird>"));
		assert.ok(isAttrUnit("px"));
		assert.ok(isAttrUnit("%"));
		assert.ok(!isAttrUnit("bananas"));
	});
});
