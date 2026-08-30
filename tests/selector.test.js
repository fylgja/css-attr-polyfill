import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { injectAttrValue } from "../src/selector.js";

describe("injectAttrValue", () => {
	it("narrows an existing bare attribute selector in place", () => {
		assert.equal(injectAttrValue("[data-py]", "data-py", "2"), '[data-py="2"]');
	});

	it("narrows inside :where() and :is(), preserving their specificity behaviour", () => {
		assert.equal(injectAttrValue(":where([data-py])", "data-py", "2"), ':where([data-py="2"])');
		assert.equal(injectAttrValue(":is([data-py])", "data-py", "2"), ':is([data-py="2"])');
	});

	it("targets the subject compound, never an ancestor", () => {
		// attr() resolves against the element the declaration applies to, which is `p`.
		assert.equal(
			injectAttrValue(".card[data-py] > p", "data-py", "2"),
			'.card[data-py] > p:where([data-py="2"])',
		);
		assert.equal(
			injectAttrValue("[data-py] [data-py]", "data-py", "2"),
			'[data-py] [data-py="2"]',
		);
	});

	it("adds no specificity when the attribute is absent from the selector", () => {
		assert.equal(injectAttrValue(".card", "data-py", "2"), '.card:where([data-py="2"])');
		assert.equal(injectAttrValue("a[href]", "data-py", "2"), 'a[href]:where([data-py="2"])');
	});

	it("inserts before a pseudo-element, since attr() reads the originating element", () => {
		assert.equal(
			injectAttrValue(".x::before", "data-label", "hi"),
			'.x:where([data-label="hi"])::before',
		);
		assert.equal(
			injectAttrValue("li > a:before", "data-x", "1"),
			'li > a:where([data-x="1"]):before',
		);
	});

	it("never narrows an attribute inside :not()", () => {
		assert.equal(
			injectAttrValue(":not([data-py])", "data-py", "2"),
			':not([data-py]):where([data-py="2"])',
		);
	});

	it("handles every branch of a selector list independently", () => {
		assert.equal(
			injectAttrValue("[data-a], .b[data-a]", "data-a", "3"),
			'[data-a="3"], .b[data-a="3"]',
		);
	});

	it("quotes values that are not valid identifiers", () => {
		// [data-py=0.5] would be invalid CSS: unquoted values must be identifiers.
		assert.equal(injectAttrValue("[data-py]", "data-py", "0.5"), '[data-py="0.5"]');
		assert.equal(injectAttrValue("[data-py]", "data-py", "2"), '[data-py="2"]');
	});

	it("escapes quotes and backslashes in the value", () => {
		assert.equal(injectAttrValue("[data-q]", "data-q", 'say "hi"'), '[data-q="say \\"hi\\""]');
	});

	it("falls back to appending when the attribute appears more than once in the subject", () => {
		assert.equal(
			injectAttrValue("[data-py][data-py]", "data-py", "2"),
			'[data-py][data-py]:where([data-py="2"])',
		);
	});
});
