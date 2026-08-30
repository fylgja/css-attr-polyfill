import { readFile } from "node:fs/promises";
import { glob } from "node:fs/promises";
import { parseAttrRefs } from "./parse-attr.js";

/**
 * Framework prefixes that turn an attribute into a runtime binding, so its value
 * cannot be read from source.
 */
const BINDING_PREFIX = String.raw`(?::|v-bind:|x-bind:|bind:|\[attr\.|\[)`;

/** Template interpolation that leaves an otherwise static-looking value unresolvable. */
const INTERPOLATION = /\{\{|\}\}|<\?|\$\{|\{%|<%|@\{/;

/** A JSX or Svelte expression holding a plain literal, e.g. {2} or {"2"}. */
const LITERAL_EXPRESSION = /^\s*(?:(['"`])(.*)\1|(-?\d+(?:\.\d+)?))\s*$/s;

/**
 * Every attribute name referenced by an attr() call in a stylesheet.
 *
 * Scanning is driven by the CSS, so markup is only searched for attributes that
 * actually feed a declaration.
 *
 * @param {string} css
 * @returns {Set<string>}
 */
export function collectAttributeNames(css) {
	const names = new Set();

	for (const match of css.matchAll(/attr\(([^)]*)/g)) {
		for (const ref of parseAttrRefs(`attr(${match[1]})`)) {
			if (ref.name && !ref.unsupported) names.add(ref.name);
		}
	}

	return names;
}

/**
 * @param {string[]} names
 * @returns {RegExp}
 */
function buildPattern(names) {
	const alternation = names
		.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
		.sort((a, b) => b.length - a.length)
		.join("|");

	return new RegExp(
		String.raw`(?<![\w-])(${BINDING_PREFIX})?(${alternation})\]?\s*=\s*` +
			String.raw`(?:"([^"]*)"|'([^']*)'|\{([^}]*)\}|([^\s"'\`=<>/]+))`,
		"g",
	);
}

/**
 * Pull attribute values out of source text.
 *
 * This deliberately extracts rather than parses, so one pass covers HTML, Markdown,
 * JSX, Vue, Svelte, Astro and server-side templates.
 *
 * @param {string} text
 * @param {Iterable<string>} attributeNames
 * @returns {{ values: Map<string, Set<string>>, dynamic: Set<string> }}
 */
export function extractAttrValues(text, attributeNames) {
	const names = [...attributeNames];
	const values = new Map();
	const dynamic = new Set();

	if (names.length === 0) return { dynamic, values };

	for (const match of text.matchAll(buildPattern(names))) {
		const [, binding, name, doubleQuoted, singleQuoted, braced, bare] = match;

		if (binding) {
			dynamic.add(name);
			continue;
		}

		let value = doubleQuoted ?? singleQuoted ?? bare;

		if (braced !== undefined) {
			const literal = LITERAL_EXPRESSION.exec(braced);
			if (!literal) {
				dynamic.add(name);
				continue;
			}
			value = literal[2] ?? literal[3];
		}

		if (value === undefined || INTERPOLATION.test(value)) {
			dynamic.add(name);
			continue;
		}

		const found = values.get(name) ?? new Set();
		found.add(value);
		values.set(name, found);
	}

	return { dynamic, values };
}

/**
 * Scan content files for the values of a set of attributes.
 *
 * @param {object} options
 * @param {string[]} options.content glob patterns, relative to cwd
 * @param {Iterable<string>} options.attributes attribute names to look for
 * @param {string} [options.cwd]
 * @returns {Promise<{ values: Map<string, Set<string>>, dynamic: Set<string>, files: number, warnings: string[] }>}
 */
export async function scan({ content, attributes, cwd = process.cwd() }) {
	const names = [...attributes];
	const values = new Map();
	const dynamic = new Set();
	let files = 0;

	if (names.length === 0 || content.length === 0) {
		return { dynamic, files, values, warnings: [] };
	}

	for await (const entry of glob(content, { cwd, withFileTypes: true })) {
		if (!entry.isFile()) continue;
		files++;

		const text = await readFile(`${entry.parentPath}/${entry.name}`, "utf8");
		const found = extractAttrValues(text, names);

		for (const [name, set] of found.values) {
			const existing = values.get(name) ?? new Set();
			for (const value of set) existing.add(value);
			values.set(name, existing);
		}
		for (const name of found.dynamic) dynamic.add(name);
	}

	const warnings = [...dynamic].map(
		(name) =>
			`"${name}" is bound at runtime in your content, so its values cannot be scanned. ` +
			`Add them to the safelist.`,
	);

	return { dynamic, files, values, warnings };
}
