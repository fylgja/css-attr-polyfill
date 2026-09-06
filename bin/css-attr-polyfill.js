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
  -c, --content <glob>      Content to scan for attribute values (repeatable)
  -s, --safelist <spec>     Values for an attribute, as name=spec (repeatable)
                            e.g. -s data-py=0..12 -s "anchor=--tip,--menu"
      --config <file>       Load options from a JS or JSON config file
      --split               Emit the fallback as a separate stylesheet
      --fallback-out <file> Where to write the fallback in split mode
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
		"fallback-out": { type: "string" },
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
			if (separator < 1) fail(`--safelist expects name=spec, got "${entry}"`);
			return [entry.slice(0, separator), entry.slice(separator + 1)];
		}),
	);
}

const [input] = positionals;
const fileConfig = flags.config
	? ((await import(pathToFileURL(flags.config).href)).default ?? {})
	: {};

const options = {
	...fileConfig,
	content: flags.content ?? fileConfig.content ?? [],
	mode: flags.split ? "split" : (fileConfig.mode ?? "combined"),
	safelist: { ...fileConfig.safelist, ...parseSafelist(flags.safelist ?? []) },
};

if (flags.supports) options.supports = flags.supports;
if (flags["max-values"]) options.maxValues = Number(flags["max-values"]);

const source = await readFile(input, "utf8").catch(() => fail(`cannot read ${input}`));
const result = await compile(source, { ...options, from: input });

if (!flags.quiet) {
	for (const warning of result.warnings) console.error(`warning: ${warning}`);
}

if (options.mode === "split") {
	const fallbackOut = flags["fallback-out"] ?? fileConfig.fallbackOut;
	if (!fallbackOut) fail("--split requires --fallback-out");
	await write(fallbackOut, result.fallback);
	if (flags.output) await write(flags.output, result.css);
	if (!flags.quiet) console.error(`wrote ${fallbackOut}`);
} else if (flags.output) {
	await write(flags.output, result.css);
	if (!flags.quiet) console.error(`wrote ${flags.output}`);
} else {
	process.stdout.write(result.css);
}
