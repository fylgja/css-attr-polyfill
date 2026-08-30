import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createResolver, expandSpec, parseAnnotations } from "../src/safelist.js";

describe("expandSpec", () => {
	it("expands inclusive ranges", () => {
		assert.deepEqual(expandSpec("0..4"), ["0", "1", "2", "3", "4"]);
		assert.deepEqual(expandSpec("4..0"), ["4", "3", "2", "1", "0"]);
	});

	it("expands stepped ranges without floating point drift", () => {
		assert.deepEqual(expandSpec("0..2 by 0.5"), ["0", "0.5", "1", "1.5", "2"]);
		assert.deepEqual(expandSpec("0..0.3 by 0.1"), ["0", "0.1", "0.2", "0.3"]);
	});

	it("emits values as markup writes them, not zero-padded", () => {
		// [data-py="1.0"] would never match markup that says data-py="1".
		assert.ok(expandSpec("0..2 by 0.5").includes("1"));
		assert.ok(!expandSpec("0..2 by 0.5").includes("1.0"));
	});

	it("accepts arrays, objects and comma lists", () => {
		assert.deepEqual(expandSpec([0, 1, 2]), ["0", "1", "2"]);
		assert.deepEqual(expandSpec({ from: 0, to: 2 }), ["0", "1", "2"]);
		assert.deepEqual(expandSpec("auto, 100%, --tip"), ["auto", "100%", "--tip"]);
	});

	it("rejects a zero step rather than looping forever", () => {
		assert.throws(() => expandSpec({ from: 0, to: 2, step: 0 }), /Invalid range/);
	});
});

describe("parseAnnotations", () => {
	it("reads attr-polyfill comments and ignores everything else", () => {
		const found = parseAnnotations([
			" attr-polyfill: data-py 0..2 ",
			" just a normal comment ",
			" attr-polyfill: anchor --tip, --menu ",
		]);
		assert.deepEqual(found.get("data-py"), ["0", "1", "2"]);
		assert.deepEqual(found.get("anchor"), ["--tip", "--menu"]);
		assert.equal(found.size, 2);
	});
});

describe("createResolver", () => {
	it("matches safelist keys with wildcards", () => {
		const resolve = createResolver({ safelist: { "data-*": "0..1" } });
		assert.deepEqual(resolve("data-py"), ["0", "1"]);
		assert.deepEqual(resolve("anchor"), []);
	});

	it("unions config, annotations and scanned values, deduplicated", () => {
		const resolve = createResolver({
			annotations: new Map([["data-py", ["2"]]]),
			safelist: { "data-py": "0..1" },
			scanned: new Map([["data-py", new Set(["1", "9"])]]),
		});
		assert.deepEqual(resolve("data-py"), ["0", "1", "2", "9"]);
	});

	it("lets annotations replace config when asked to", () => {
		const resolve = createResolver({
			annotationMode: "override",
			annotations: new Map([["data-py", ["7"]]]),
			safelist: { "data-py": "0..1" },
		});
		assert.deepEqual(resolve("data-py"), ["7"]);
	});
});
