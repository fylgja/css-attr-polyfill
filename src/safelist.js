/**
 * Value sources for attributes that scanning cannot resolve, and for builds that run
 * without scanning at all.
 */

const RANGE = /^\s*(-?[\d.]+)\s*\.\.\s*(-?[\d.]+)\s*(?:by\s+([\d.]+)\s*)?$/;

/** Matches `/* attr-polyfill: data-py 0..12 by 0.5 *\/` and comma-separated variants. */
const ANNOTATION = /^\s*attr-polyfill:\s*([^\s]+)\s+(.+?)\s*$/;

/**
 * Count decimal places so stepped ranges avoid binary floating point drift.
 *
 * @param {...string} numbers
 * @returns {number}
 */
function precisionOf(...numbers) {
	return Math.max(...numbers.map((n) => (n.split(".")[1] ?? "").length));
}

/**
 * Expand a value specification into concrete attribute values.
 *
 * Accepts an array, a `{ from, to, step }` object, a `"0..12 by 0.5"` range string,
 * or a comma-separated list.
 *
 * @param {string[] | number[] | string | { from: number, to: number, step?: number }} spec
 * @returns {string[]}
 */
export function expandSpec(spec) {
	if (Array.isArray(spec)) return spec.map(String);

	if (spec && typeof spec === "object") {
		const { from, to, step = 1 } = spec;
		return expandRange(String(from), String(to), String(step));
	}

	const text = String(spec);
	const range = RANGE.exec(text);
	if (range) return expandRange(range[1], range[2], range[3] ?? "1");

	return text
		.split(",")
		.map((part) => part.trim())
		.filter(Boolean);
}

/**
 * @param {string} from
 * @param {string} to
 * @param {string} step
 * @returns {string[]}
 */
function expandRange(from, to, step) {
	const start = Number(from);
	const end = Number(to);
	const increment = Math.abs(Number(step));

	if (!Number.isFinite(start) || !Number.isFinite(end) || !increment) {
		throw new Error(`Invalid range "${from}..${to} by ${step}"`);
	}

	const digits = precisionOf(from, to, step);
	const scale = 10 ** digits;
	const direction = end >= start ? 1 : -1;
	const values = [];

	for (let i = 0; ; i++) {
		const next = Math.round((start + direction * i * increment) * scale) / scale;
		if (direction > 0 ? next > end : next < end) break;
		// String() rather than toFixed(): markup writes data-py="1", never "1.0".
		values.push(String(next));
		if (values.length > 100_000)
			throw new Error(`Range "${from}..${to}" is unreasonably large`);
	}

	return values;
}

/**
 * @param {string} pattern key that may contain `*` wildcards
 * @param {string} name attribute name
 * @returns {boolean}
 */
function matchesPattern(pattern, name) {
	if (!pattern.includes("*")) return pattern === name;
	const source = pattern
		.split("*")
		.map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
		.join(".*");
	return new RegExp(`^${source}$`).test(name);
}

/**
 * Read `attr-polyfill:` annotations out of CSS comment text.
 *
 * @param {string[]} comments raw comment bodies
 * @returns {Map<string, string[]>}
 */
export function parseAnnotations(comments) {
	const found = new Map();

	for (const comment of comments) {
		const match = ANNOTATION.exec(comment);
		if (!match) continue;
		const [, name, spec] = match;
		const values = found.get(name) ?? [];
		found.set(name, [...values, ...expandSpec(spec)]);
	}

	return found;
}

/**
 * Build the value lookup passed to the generator.
 *
 * @param {object} sources
 * @param {Record<string, unknown>} [sources.safelist] config entries, keys may use `*`
 * @param {Map<string, string[]>} [sources.annotations] values found in CSS comments
 * @param {Map<string, Set<string>>} [sources.scanned] values found by the content scanner
 * @param {"merge" | "override"} [sources.annotationMode] how annotations combine with config
 * @returns {(attribute: string) => string[]}
 */
export function createResolver({
	safelist = {},
	annotations = new Map(),
	scanned = new Map(),
	annotationMode = "merge",
} = {}) {
	const cache = new Map();

	return (attribute) => {
		if (cache.has(attribute)) return cache.get(attribute);

		const annotated = annotations.get(attribute) ?? [];
		const fromConfig =
			annotationMode === "override" && annotated.length
				? []
				: Object.entries(safelist)
						.filter(([pattern]) => matchesPattern(pattern, attribute))
						.flatMap(([, spec]) => expandSpec(spec));

		const values = [
			...new Set([...fromConfig, ...annotated, ...(scanned.get(attribute) ?? [])]),
		];
		cache.set(attribute, values);
		return values;
	};
}
