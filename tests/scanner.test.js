import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { collectAttributeNames, extractAttrValues } from "../src/scanner.js";

const names = ["data-py", "data-size", "anchor"];
const extract = (text) => extractAttrValues(text, names);

describe("collectAttributeNames", () => {
	it("takes attribute names from the stylesheet's attr() calls", () => {
		const css = `
            [data-py] { padding-block: calc(var(--spacing) * attr(data-py type(<number>), 1)); }
            [anchor] { anchor-name: attr(anchor type(<custom-ident>)); }
            .x { color: red; }
        `;
		assert.deepEqual([...collectAttributeNames(css)].sort(), ["anchor", "data-py"]);
	});

	it("ignores attr() forms that cannot be compiled", () => {
		assert.deepEqual([...collectAttributeNames("a { b: attr(ns|foo type(<number>)); }")], []);
	});
});

describe("extractAttrValues", () => {
	it("reads double, single and unquoted HTML attributes", () => {
		const { values } = extract(`<div data-py="2"></div><b data-py='3'><i data-py=4>`);
		assert.deepEqual([...values.get("data-py")], ["2", "3", "4"]);
	});

	it("reads JSX and Svelte brace literals", () => {
		const { values } = extract(`<div data-py={2} /><div data-py={"3"} /><div data-py={'4'} />`);
		assert.deepEqual([...values.get("data-py")], ["2", "3", "4"]);
	});

	it("reads server-side template attributes that are static", () => {
		const { values } = extract(`<div data-py="2"><?php echo "x"; ?></div>`);
		assert.deepEqual([...values.get("data-py")], ["2"]);
	});

	it("flags framework bindings as dynamic rather than reading the expression", () => {
		for (const source of [
			`<div :data-py="n">`,
			`<div v-bind:data-py="n">`,
			`<div bind:data-py={n}>`,
			`<div [attr.data-py]="n">`,
		]) {
			const { values, dynamic } = extract(source);
			assert.ok(dynamic.has("data-py"), source);
			assert.equal(values.get("data-py"), undefined, source);
		}
	});

	it("flags interpolated values as dynamic", () => {
		for (const source of [
			`<div data-py="{{ n }}">`,
			`<div data-py="<?= $n ?>">`,
			`<div data-py="${"${n}"}">`,
			`<div data-py={n}>`,
			`<div data-py={n + 1}>`,
		]) {
			const { dynamic } = extract(source);
			assert.ok(dynamic.has("data-py"), source);
		}
	});

	it("does not match a longer attribute name as a shorter one", () => {
		const { values } = extractAttrValues(`<div data-md-py="2">`, ["data-py", "data-md-py"]);
		assert.equal(values.get("data-py"), undefined);
		assert.deepEqual([...values.get("data-md-py")], ["2"]);
	});

	it("ignores attributes it was not asked about", () => {
		const { values } = extract(`<div data-other="9" data-py="2">`);
		assert.deepEqual([...values.keys()], ["data-py"]);
	});

	it("handles a self-closing tag with an unquoted value", () => {
		const { values } = extract(`<img data-py=2/>`);
		assert.deepEqual([...values.get("data-py")], ["2"]);
	});

	it("collects the same attribute across many elements, deduplicated", () => {
		const { values } = extract(`<a data-py="2"><b data-py="2"><c data-py="3">`);
		assert.deepEqual([...values.get("data-py")], ["2", "3"]);
	});
});
