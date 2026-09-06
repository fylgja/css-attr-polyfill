import valueParser from "postcss-value-parser";
import { isAttrUnit, isKnownSyntax } from "./types.js";

/**
 * @typedef {{ kind: "syntax", syntax: string }
 *   | { kind: "unit", unit: string }
 *   | { kind: "raw-string" }
 *   | { kind: "string" }} AttrType
 */

/**
 * @typedef {object} AttrRef
 * @property {string} name attribute name, e.g. "data-py"
 * @property {AttrType} type declared substitution type
 * @property {string | null} fallback source text of the fallback argument
 * @property {number} index position among the attr() calls in the declaration value
 * @property {string | null} unsupported reason this reference cannot be compiled
 */

/**
 * Split a function's children on top-level commas.
 *
 * @param {import("postcss-value-parser").Node[]} nodes
 * @returns {import("postcss-value-parser").Node[][]}
 */
function splitOnCommas(nodes) {
	const groups = [[]];
	for (const node of nodes) {
		if (node.type === "div" && node.value === ",") groups.push([]);
		else groups.at(-1).push(node);
	}
	return groups;
}

/**
 * Read the `<attr-type>` slot, which may be `type(<syntax>)`, `raw-string` or a bare unit.
 *
 * @param {import("postcss-value-parser").Node} node
 * @returns {{ type: AttrType } | { error: string }}
 */
function readType(node) {
	if (node.type === "function" && node.value === "type") {
		const syntax = valueParser.stringify(node.nodes).trim();
		if (!isKnownSyntax(syntax))
			return { error: `unsupported type(${syntax})` };
		return { type: { kind: "syntax", syntax } };
	}

	if (node.type === "word") {
		if (node.value === "raw-string")
			return { type: { kind: "raw-string" } };
		if (isAttrUnit(node.value))
			return { type: { kind: "unit", unit: node.value.toLowerCase() } };
		return { error: `unrecognised attr() type "${node.value}"` };
	}

	return {
		error: `unrecognised attr() type "${valueParser.stringify(node)}"`,
	};
}

/**
 * Locate and describe every attr() call in a declaration value.
 *
 * @param {string} value declaration value source text
 * @returns {AttrRef[]}
 */
export function parseAttrRefs(value) {
	if (!value.includes("attr(")) return [];

	const refs = [];
	valueParser(value).walk((node) => {
		if (node.type !== "function" || node.value !== "attr") return;

		const index = refs.length;
		const [head = [], ...tail] = splitOnCommas(node.nodes);
		const fallback = tail.length
			? tail
					.map((g) => valueParser.stringify(g))
					.join(",")
					.trim()
			: null;
		const significant = head.filter(
			(n) => n.type !== "space" && n.type !== "comment",
		);

		const push = (partial) =>
			refs.push({
				fallback,
				index,
				type: { kind: "string" },
				...partial,
			});

		if (significant.length === 0) {
			push({
				name: "",
				unsupported: "attr() is missing an attribute name",
			});
			return;
		}

		const [nameNode, typeNode, ...rest] = significant;
		if (nameNode.type !== "word") {
			push({
				name: "",
				unsupported: "attr() attribute name is not an identifier",
			});
			return;
		}

		const name = nameNode.value;
		// Namespaced attribute names cannot be expressed by a plain attribute selector.
		if (name.includes("|")) {
			push({
				name,
				unsupported: `namespaced attribute "${name}" is not supported`,
			});
			return;
		}

		if (rest.length) {
			push({
				name,
				unsupported: "attr() has unexpected extra arguments",
			});
			return;
		}

		if (!typeNode) {
			push({ name, unsupported: null });
			return;
		}

		const result = readType(typeNode);
		if ("error" in result) {
			push({ name, unsupported: result.error });
			return;
		}

		push({ name, type: result.type, unsupported: null });
	});

	return refs;
}

/**
 * Rewrite one attr() call in a declaration value, leaving the rest of the value untouched.
 *
 * @param {string} value declaration value source text
 * @param {number} index which attr() call to replace
 * @param {string} substitution CSS token sequence to put in its place
 * @returns {string}
 */
export function substituteAttr(value, index, substitution) {
	const parsed = valueParser(value);
	let seen = 0;
	parsed.walk((node) => {
		if (node.type !== "function" || node.value !== "attr") return;
		if (seen++ !== index) return;
		node.type = "word";
		node.value = substitution;
		delete node.nodes;
	});
	return valueParser.stringify(parsed);
}
