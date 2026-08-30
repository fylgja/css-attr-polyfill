import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateFallbacks } from "../src/generate.js";

const resolver = (values) => (attribute) => values[attribute] ?? [];

const spacing = {
	prop: "padding-block",
	selector: "[data-py]",
	value: "calc(var(--spacing) * attr(data-py type(<number>), 1))",
};

describe("generateFallbacks", () => {
	it("does nothing for declarations without attr()", () => {
		const result = generateFallbacks(
			{ prop: "color", selector: ".x", value: "red" },
			resolver({}),
		);
		assert.deepEqual(result.rules, []);
	});

	it("emits a base rule carrying attr()'s own fallback, before the value rules", () => {
		const { rules } = generateFallbacks(spacing, resolver({ "data-py": ["2"] }));
		assert.deepEqual(rules, [
			{ prop: "padding-block", selector: "[data-py]", value: "calc(var(--spacing) * 1)" },
			{ prop: "padding-block", selector: '[data-py="2"]', value: "calc(var(--spacing) * 2)" },
		]);
	});

	it("emits no base rule when attr() has no fallback", () => {
		const { rules } = generateFallbacks(
			{
				prop: "anchor-name",
				selector: "[anchor]",
				value: "attr(anchor type(<custom-ident>))",
			},
			resolver({ anchor: ["--tip"] }),
		);
		assert.deepEqual(rules, [
			{ prop: "anchor-name", selector: '[anchor="--tip"]', value: "--tip" },
		]);
	});

	it("skips values that are invalid for the type and says so", () => {
		const { rules, warnings } = generateFallbacks(
			spacing,
			resolver({ "data-py": ["1", "oops", "2"] }),
		);
		assert.deepEqual(
			rules.map((r) => r.selector),
			["[data-py]", '[data-py="1"]', '[data-py="2"]'],
		);
		assert.equal(warnings.length, 1);
		assert.match(warnings[0], /not valid/);
		assert.match(warnings[0], /"oops"/);
	});

	it("deduplicates repeated values", () => {
		const { rules } = generateFallbacks(spacing, resolver({ "data-py": ["2", "2", "2"] }));
		assert.equal(rules.length, 2);
	});

	it("refuses declarations with more than one attr(), rather than guessing a product", () => {
		const { rules, warnings } = generateFallbacks(
			{
				prop: "margin",
				selector: "[data-a]",
				value: "attr(data-a type(<number>)) attr(data-b type(<number>))",
			},
			resolver({ "data-a": ["1"], "data-b": ["2"] }),
		);
		assert.deepEqual(rules, []);
		assert.match(warnings[0], /multiple attr\(\) references \(data-a, data-b\)/);
	});

	it("passes through unsupported attr() forms untouched, with a warning", () => {
		const { rules, warnings } = generateFallbacks(
			{ prop: "width", selector: "[data-x]", value: "attr(data-x type(<weird>))" },
			resolver({ "data-x": ["1"] }),
		);
		assert.deepEqual(rules, []);
		assert.match(warnings[0], /unsupported type/);
	});

	it("caps generated rules and reports what it dropped", () => {
		const values = Array.from({ length: 10 }, (_, i) => String(i));
		const { rules, warnings } = generateFallbacks(spacing, resolver({ "data-py": values }), {
			maxValues: 4,
		});
		assert.equal(rules.length, 5); // one base rule plus the cap
		assert.match(warnings[0], /6 value\(s\).*dropped/);
	});
});
