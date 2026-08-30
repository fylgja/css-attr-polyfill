import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseAttrRefs, substituteAttr } from "../src/parse-attr.js";

describe("parseAttrRefs", () => {
	it("returns nothing for values without attr()", () => {
		assert.deepEqual(parseAttrRefs("calc(var(--spacing) * 2)"), []);
	});

	it("reads name, type and fallback from a typed attr()", () => {
		const [ref] = parseAttrRefs("calc(var(--spacing) * attr(data-py type(<number>), 1))");
		assert.equal(ref.name, "data-py");
		assert.deepEqual(ref.type, { kind: "syntax", syntax: "<number>" });
		assert.equal(ref.fallback, "1");
		assert.equal(ref.unsupported, null);
	});

	it("handles a missing fallback", () => {
		const [ref] = parseAttrRefs("attr(anchor type(<custom-ident>))");
		assert.equal(ref.fallback, null);
		assert.deepEqual(ref.type, { kind: "syntax", syntax: "<custom-ident>" });
	});

	it("treats a bare attr() as a string", () => {
		const [ref] = parseAttrRefs("attr(data-label)");
		assert.deepEqual(ref.type, { kind: "string" });
	});

	it("reads raw-string and attr-unit type forms", () => {
		assert.deepEqual(parseAttrRefs("attr(data-s raw-string)")[0].type, { kind: "raw-string" });
		assert.deepEqual(parseAttrRefs("attr(data-w px)")[0].type, { kind: "unit", unit: "px" });
	});

	it("keeps commas inside a fallback intact", () => {
		const [ref] = parseAttrRefs("attr(data-c type(<color>), rgb(1, 2, 3))");
		assert.equal(ref.fallback, "rgb(1, 2, 3)");
	});

	it("flags forms it cannot compile", () => {
		assert.match(parseAttrRefs("attr(ns|foo type(<number>))")[0].unsupported, /namespaced/);
		assert.match(
			parseAttrRefs("attr(data-x type(<weird>))")[0].unsupported,
			/unsupported type/,
		);
		assert.match(parseAttrRefs("attr(data-x bananas)")[0].unsupported, /unrecognised/);
		assert.match(parseAttrRefs("attr()")[0].unsupported, /missing an attribute name/);
	});

	it("finds every attr() in a declaration, in order", () => {
		const refs = parseAttrRefs("attr(data-a type(<number>)) attr(data-b type(<number>))");
		assert.deepEqual(
			refs.map((r) => r.name),
			["data-a", "data-b"],
		);
		assert.deepEqual(
			refs.map((r) => r.index),
			[0, 1],
		);
	});
});

describe("substituteAttr", () => {
	it("replaces one attr() and leaves the rest of the value alone", () => {
		assert.equal(
			substituteAttr("calc(var(--spacing) * attr(data-py type(<number>), 1))", 0, "2"),
			"calc(var(--spacing) * 2)",
		);
	});

	it("replaces attr() nested inside another function", () => {
		assert.equal(
			substituteAttr("clamp(1px, attr(data-w type(<length>), 2px), 9px)", 0, "5rem"),
			"clamp(1px, 5rem, 9px)",
		);
	});

	it("targets the requested occurrence only", () => {
		const value = "attr(data-a type(<number>)) attr(data-b type(<number>))";
		assert.equal(substituteAttr(value, 1, "9"), "attr(data-a type(<number>)) 9");
	});
});
