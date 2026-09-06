/**
 * Type validation and rendering for CSS attr() v2 substitution values.
 *
 * A scanned attribute value only earns a generated rule if it actually parses as the
 * declared type. Native attr() falls back to its fallback argument otherwise, so emitting
 * a rule for an unparseable value would diverge from browser behaviour.
 */

const NUMBER = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;
const INTEGER = /^[+-]?\d+$/;
const IDENT = /^-{0,2}(?:[A-Za-z_]|[^\x00-\x7F])(?:[\w-]|[^\x00-\x7F])*$/;
const HEX = /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const COLOR_FN = /^(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix|light-dark)\(/i;

const CSS_WIDE_KEYWORDS = new Set([
	"initial",
	"inherit",
	"unset",
	"revert",
	"revert-layer",
	"default",
]);

/** Every named colour in CSS Color Level 4, plus the two keywords. */
const NAMED_COLORS = new Set([
	"aliceblue",
	"antiquewhite",
	"aqua",
	"aquamarine",
	"azure",
	"beige",
	"bisque",
	"black",
	"blanchedalmond",
	"blue",
	"blueviolet",
	"brown",
	"burlywood",
	"cadetblue",
	"chartreuse",
	"chocolate",
	"coral",
	"cornflowerblue",
	"cornsilk",
	"crimson",
	"cyan",
	"darkblue",
	"darkcyan",
	"darkgoldenrod",
	"darkgray",
	"darkgreen",
	"darkgrey",
	"darkkhaki",
	"darkmagenta",
	"darkolivegreen",
	"darkorange",
	"darkorchid",
	"darkred",
	"darksalmon",
	"darkseagreen",
	"darkslateblue",
	"darkslategray",
	"darkslategrey",
	"darkturquoise",
	"darkviolet",
	"deeppink",
	"deepskyblue",
	"dimgray",
	"dimgrey",
	"dodgerblue",
	"firebrick",
	"floralwhite",
	"forestgreen",
	"fuchsia",
	"gainsboro",
	"ghostwhite",
	"gold",
	"goldenrod",
	"gray",
	"green",
	"greenyellow",
	"grey",
	"honeydew",
	"hotpink",
	"indianred",
	"indigo",
	"ivory",
	"khaki",
	"lavender",
	"lavenderblush",
	"lawngreen",
	"lemonchiffon",
	"lightblue",
	"lightcoral",
	"lightcyan",
	"lightgoldenrodyellow",
	"lightgray",
	"lightgreen",
	"lightgrey",
	"lightpink",
	"lightsalmon",
	"lightseagreen",
	"lightskyblue",
	"lightslategray",
	"lightslategrey",
	"lightsteelblue",
	"lightyellow",
	"lime",
	"limegreen",
	"linen",
	"magenta",
	"maroon",
	"mediumaquamarine",
	"mediumblue",
	"mediumorchid",
	"mediumpurple",
	"mediumseagreen",
	"mediumslateblue",
	"mediumspringgreen",
	"mediumturquoise",
	"mediumvioletred",
	"midnightblue",
	"mintcream",
	"mistyrose",
	"moccasin",
	"navajowhite",
	"navy",
	"oldlace",
	"olive",
	"olivedrab",
	"orange",
	"orangered",
	"orchid",
	"palegoldenrod",
	"palegreen",
	"paleturquoise",
	"palevioletred",
	"papayawhip",
	"peachpuff",
	"peru",
	"pink",
	"plum",
	"powderblue",
	"purple",
	"rebeccapurple",
	"red",
	"rosybrown",
	"royalblue",
	"saddlebrown",
	"salmon",
	"sandybrown",
	"seagreen",
	"seashell",
	"sienna",
	"silver",
	"skyblue",
	"slateblue",
	"slategray",
	"slategrey",
	"snow",
	"springgreen",
	"steelblue",
	"tan",
	"teal",
	"thistle",
	"tomato",
	"turquoise",
	"violet",
	"wheat",
	"white",
	"whitesmoke",
	"yellow",
	"yellowgreen",
	"transparent",
	"currentcolor",
]);

const UNITS = {
	length: new Set([
		"px",
		"em",
		"rem",
		"ex",
		"ch",
		"rex",
		"rch",
		"cap",
		"rcap",
		"ic",
		"ric",
		"lh",
		"rlh",
		"vw",
		"vh",
		"vi",
		"vb",
		"vmin",
		"vmax",
		"svw",
		"svh",
		"svi",
		"svb",
		"svmin",
		"svmax",
		"lvw",
		"lvh",
		"lvi",
		"lvb",
		"lvmin",
		"lvmax",
		"dvw",
		"dvh",
		"dvi",
		"dvb",
		"dvmin",
		"dvmax",
		"cqw",
		"cqh",
		"cqi",
		"cqb",
		"cqmin",
		"cqmax",
		"cm",
		"mm",
		"q",
		"in",
		"pt",
		"pc",
	]),
	angle: new Set(["deg", "grad", "rad", "turn"]),
	time: new Set(["s", "ms"]),
	resolution: new Set(["dpi", "dpcm", "dppx", "x"]),
	frequency: new Set(["hz", "khz"]),
	flex: new Set(["fr"]),
};

/** Every unit accepted by the `<attr-unit>` form, e.g. `attr(data-w px)`. */
const ALL_UNITS = new Set(["%", ...Object.values(UNITS).flatMap((set) => [...set])]);

/**
 * Split a dimension into its numeric part and its lowercased unit.
 *
 * @param {string} value
 * @returns {{ number: string, unit: string } | null}
 */
function splitDimension(value) {
	const match = /^([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)([a-zA-Z%]+)$/.exec(value);
	return match ? { number: match[1], unit: match[2].toLowerCase() } : null;
}

/**
 * @param {string} value
 * @param {string} kind key of UNITS
 * @returns {boolean}
 */
function isDimension(value, kind) {
	const parts = splitDimension(value);
	if (parts) return UNITS[kind].has(parts.unit);
	// A unitless zero is a valid <length>, but not a valid <angle>, <time> or <frequency>.
	return kind === "length" && NUMBER.test(value) && Number(value) === 0;
}

/**
 * @param {string} value
 * @returns {boolean}
 */
function isPercentage(value) {
	const parts = splitDimension(value);
	return parts ? parts.unit === "%" : false;
}

/**
 * @param {string} value
 * @returns {boolean}
 */
function isColor(value) {
	const lower = value.toLowerCase();
	return HEX.test(value) || NAMED_COLORS.has(lower) || COLOR_FN.test(value);
}

/**
 * @param {string} value
 * @returns {boolean}
 */
function isCustomIdent(value) {
	return IDENT.test(value) && !CSS_WIDE_KEYWORDS.has(value.toLowerCase());
}

/** Predicates for each `type(<syntax>)` this package understands. */
const SYNTAX = {
	"<number>": (v) => NUMBER.test(v),
	"<integer>": (v) => INTEGER.test(v),
	"<length>": (v) => isDimension(v, "length"),
	"<angle>": (v) => isDimension(v, "angle"),
	"<time>": (v) => isDimension(v, "time"),
	"<resolution>": (v) => isDimension(v, "resolution"),
	"<frequency>": (v) => isDimension(v, "frequency"),
	"<flex>": (v) => isDimension(v, "flex"),
	"<percentage>": isPercentage,
	"<length-percentage>": (v) => isDimension(v, "length") || isPercentage(v),
	"<color>": isColor,
	"<custom-ident>": isCustomIdent,
	"<string>": () => true,
	"<url>": (v) => v.length > 0,
};

/**
 * Escape a value for use inside a double-quoted CSS string.
 *
 * @param {string} value
 * @returns {string}
 */
export function quoteString(value) {
	return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/**
 * Whether a `type()` syntax string is supported.
 *
 * @param {string} syntax
 * @returns {boolean}
 */
export function isKnownSyntax(syntax) {
	return Object.hasOwn(SYNTAX, syntax);
}

/**
 * Whether an identifier is usable as an `<attr-unit>`.
 *
 * @param {string} unit
 * @returns {boolean}
 */
export function isAttrUnit(unit) {
	return ALL_UNITS.has(unit.toLowerCase());
}

/**
 * Render an attribute value as the CSS token sequence attr() would substitute.
 *
 * @param {string} value raw attribute value from markup or a safelist
 * @param {import("./parse-attr.js").AttrType} type
 * @returns {string | null} substitution text, or null when the value is invalid for the type
 */
export function renderValue(value, type) {
	const trimmed = value.trim();

	switch (type.kind) {
		case "string":
		case "raw-string":
			return quoteString(value);

		case "unit": {
			if (!NUMBER.test(trimmed)) return null;
			return `${trimmed}${type.unit}`;
		}

		case "syntax": {
			const check = SYNTAX[type.syntax];
			if (!check || !check(trimmed)) return null;
			if (type.syntax === "<string>") return quoteString(value);
			if (type.syntax === "<url>") return `url(${quoteString(value)})`;
			return trimmed;
		}

		default:
			return null;
	}
}
