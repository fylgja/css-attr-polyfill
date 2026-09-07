#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { parseArgs } from "node:util";
import { pathToFileURL } from "node:url";
import { compile } from "../src/compile.js";

const USAGE = `
Usage: css-attr-polyfill <input.css> [options]

Compiles CSS attr() v2 into static fallback rules for browsers without support.

Options:
  -o, --output <file>       Write the result here (default: stdout)
                            In --split mode this is the fallback stylesheet
  -c, --content <glob>      Content to scan for attribute values (repeatable)
  -s, --safelist <spec>     Values for an attribute, as name=spec (repeatable)
                            e.g. -s data-py=0..12 -s "anchor=--tip,--menu"
      --config <file>       Load options from a JS or JSON config file
      --split               Output only the fallback, leaving the source alone
      --supports <cond>     Override the @supports condition guarding the fallback
      --max-values <n>      Cap on generated rules per declaration
      --quiet               Do not print warnings
  -h, --help                Show this message
`.trim();

const { positionals, values: flags } = parseArgs({
	allowPositionals: true,
	options: {
		config: { type: "string" },
		content: { multiple: true, short: "c", type: "string" },
		help: { short: "h", type: "boolean" },
		"max-values": { type: "string" },
		output: { short: "o", type: "string" },
		quiet: { type: "boolean" },
		safelist: { multiple: true, short: "s", type: "string" },
		split: { type: "boolean" },
		supports: { type: "string" },
	},
});

/**
 * Write a file, creating its directory when it does not exist yet.
 *
 * @param {string} path
 * @param {string} contents
 * @returns {Promise<void>}
 */
async function write(path, contents) {
	await mkdir(dirname(path), { recursive: true });
	await writeFile(path, contents);
}

/**
 * @param {string} message
 * @returns {never}
 */
function fail(message) {
	console.error(`css-attr-polyfill: ${message}`);
	process.exit(1);
}

if (flags.help || positionals.length === 0) {
	console.log(USAGE);
	process.exit(flags.help ? 0 : 1);
}

if (positionals.length > 1) fail("expected a single input file");

/**
 * Turn repeated `name=spec` flags into a safelist object.
 *
 * @param {string[]} entries
 * @returns {Record<string, string>}
 */
function parseSafelist(entries) {
	return Object.fromEntries(
		entries.map((entry) => {
			const separator = entry.indexOf("=");
			if (separator < 1)
				fail(`--safelist expects name=spec, got "${entry}"`);
			return [entry.slice(0, separator), entry.slice(separator + 1)];
		}),
	);
}

/**
 * Load a config file.
 *
 * JSON is read and parsed directly. Importing it would need an `import ... with
 * { type: "json" }` attribute, which is awkward to express through a dynamic import
 * and varies by Node version.
 *
 * @param {string} path
 * @returns {Promise<object>}
 */
async function loadConfig(path) {
	if (path.endsWith(".json")) {
		const contents = await readFile(path, "utf8").catch(() => fail(`cannot read ${path}`));
		try {
			return JSON.parse(contents);
		} catch (error) {
			fail(`${path} is not valid JSON: ${error.message}`);
		}
	}

	const module = await import(pathToFileURL(path).href).catch(() =>
		fail(`cannot load ${path}`),
	);
	return module.default ?? {};
}

const [input] = positionals;
const fileConfig = flags.config ? await loadConfig(flags.config) : {};

const options = {
	...fileConfig,
	content: flags.content ?? fileConfig.content ?? [],
	mode: flags.split ? "split" : (fileConfig.mode ?? "combined"),
	safelist: {
		...fileConfig.safelist,
		...parseSafelist(flags.safelist ?? []),
	},
};

if (flags.supports) options.supports = flags.supports;
if (flags["max-values"]) options.maxValues = Number(flags["max-values"]);

const source = await readFile(input, "utf8").catch(() =>
	fail(`cannot read ${input}`),
);
const result = await compile(source, { ...options, from: input });

if (!flags.quiet) {
	for (const warning of result.warnings) console.error(`warning: ${warning}`);
}

// Split mode leaves the source untouched, so the fallback is the only output worth
// writing. There is nothing for a second destination to hold.
const output = flags.output ?? fileConfig.output;
const stylesheet = options.mode === "split" ? result.fallback : result.css;

if (output) {
	await write(output, stylesheet);
	if (!flags.quiet) console.error(`wrote ${output}`);
} else {
	process.stdout.write(stylesheet);
}
