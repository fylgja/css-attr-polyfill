# Fylgja - CSS attr polyfill

[![NPM version](https://img.shields.io/npm/v/@fylgja/css-attr-polyfill?logo=npm)](https://www.npmjs.com/package/@fylgja/css-attr-polyfill)
[![License](https://img.shields.io/github/license/fylgja/css-attr-polyfill?color=%23234)](/LICENSE)

Compile CSS `attr()` v2 into static fallback rules for browsers that do not support it.

This is a build time compiler, not a runtime polyfill. It reads your stylesheet, works out
which attribute values your project actually uses, and writes the equivalent static CSS.

```css
/* you write this */
[data-py] {
    padding-block: calc(var(--spacing) * attr(data-py type(<number>), 1));
}
```

```css
/* you also get this */
@supports not (padding: attr(x type(<length>), 1px)) {
    [data-py] {
        padding-block: calc(var(--spacing) * 1);
    }
    [data-py="2"] {
        padding-block: calc(var(--spacing) * 2);
    }
    [data-py="4"] {
        padding-block: calc(var(--spacing) * 4);
    }
}
```

## Installation

```bash
npm install @fylgja/css-attr-polyfill
```

Requires Node 22 or newer.

### Dependencies

The core depends on two small string level parsers and nothing else. Despite their names,
neither is PostCSS, and `postcss-value-parser` has no dependencies of its own.

| Package                   | Used for                     |
| ------------------------- | ---------------------------- |
| `postcss-value-parser`    | Reading the `attr()` grammar |
| `postcss-selector-parser` | Narrowing selectors safely   |

CSS documents are read by a parser built into this package, so nothing pulls in a CSS
framework. `postcss`, `lightningcss` and `vite` are optional peers, needed only by the
integration you actually use.

## Why it works

The generated rules are wrapped in `@supports not (...)`, whose condition is false in
browsers that support `attr()` v2 and true everywhere else. Only one of the two paths is
ever live, so they cannot fight.

Within the fallback path, the generated rules are emitted **after** the `attr()` rule they
stand in for. Browsers vary in how they treat an unsupported `attr()`: some drop the
declaration outright, but Safari keeps it. A fallback placed earlier would lose to the very
rule it replaces.

Modern browsers keep the original `attr()` declaration untouched, so values outside the
generated set still work there.

## Usage

### CLI

```bash
css-attr-polyfill utilities.css -c "src/**/*.{html,jsx,vue}" -o utilities.compiled.css
```

| Option                  | Description                                              |
| ----------------------- | -------------------------------------------------------- |
| `-o, --output <file>`   | Write the result here (default: stdout)                  |
| `-c, --content <glob>`  | Content to scan for attribute values (repeatable)        |
| `-s, --safelist <spec>` | Values for an attribute, as `name=spec` (repeatable)     |
| `--config <file>`       | Load options from a JS or JSON config file               |
| `--split`               | Emit the fallback as a separate stylesheet               |
| `--fallback-out <file>` | Where to write the fallback in split mode                |
| `--supports <cond>`     | Override the `@supports` condition guarding the fallback |
| `--max-values <n>`      | Cap on generated rules per declaration                   |
| `--quiet`               | Do not print warnings                                    |

### API

```js
import { compile } from "@fylgja/css-attr-polyfill";

const { css, warnings } = await compile(source, {
    content: ["src/**/*.{html,jsx,vue}"],
    safelist: { "data-*": "0..12 by 0.5" },
});
```

Use `transform()` instead of `compile()` if you already have the values and want a
synchronous, filesystem free call.

## Where values come from

A typed `attr()` is unbounded, so a static stylesheet cannot cover every possible value.
Three sources feed the generator, and their results are combined.

**Content scanning.** Point `content` at your markup and the scanner extracts the attribute
values you actually use. It handles HTML, Markdown, JSX, TSX, Vue, Svelte, Astro and
server side templates such as PHP, Twig and Blade. It extracts rather than parses, so one
pass covers all of them.

**Safelist.** For values scanning cannot see, list them in config. Keys accept `*` wildcards
and values accept ranges, lists or arrays.

```js
{
  safelist: {
    "data-*": "0..12 by 0.5",
    "anchor": "--tip, --menu",
    "data-cols": [1, 2, 3, 4],
  }
}
```

**In CSS annotations.** Useful when the stylesheet is distributed on its own, since the
values travel with it.

```css
/* attr-polyfill: data-py 0..12 by 0.5 */
[data-py] {
    padding-block: calc(var(--spacing) * attr(data-py type(<number>), 1));
}
```

Annotations are merged with config by default. Set `annotationMode: "override"` to have
them replace it instead.

## Output modes

`combined` (the default) splices each fallback in immediately after its source rule. It has
to come after, not before: browsers without `attr()` v2 do not reliably drop the declaration
at parse time. Safari keeps it, so a fallback placed earlier would lose to the very rule it
stands in for. Staying adjacent keeps the source rule's position relative to everything else
in the stylesheet. Every byte the compiler does not touch is preserved exactly as authored,
including your own formatting and comments.

`split` leaves the source stylesheet untouched and returns a second stylesheet containing
only the fallbacks, mirroring any `@layer`, `@media` or `@container` nesting. The `@supports`
guard sits innermost so layer names still register. **Load the fallback stylesheet after the
source**, for the same reason combined mode places it after.

## What it will not do

**Runtime bound attributes.** `:data-py="n"` in Vue, `data-py={n}` in JSX or anything set
from JavaScript cannot be read from source. These are detected and reported, and you should
safelist their values.

**More than one `attr()` in a declaration.** `margin: attr(data-a ...) attr(data-b ...)`
needs a cartesian product of both value sets, which the scanner does not have the
co-occurrence data to bound. Such declarations are skipped with a warning.

**Values outside the generated set.** In browsers without `attr()` v2 these fall back to the
value in the `attr()` fallback argument, exactly as an invalid attribute value would natively.

## Behaviour worth knowing

Values are validated against the declared type. `data-py="abc"` against `type(<number>)`
produces no rule, because native `attr()` would resolve to its fallback there too.

Attribute values are always quoted in generated selectors. `[data-py=2]` is invalid CSS,
since unquoted attribute values must be valid identifiers.

Selectors are narrowed at their subject, never at an ancestor. `attr()` resolves against the
element the declaration applies to, so `.card[data-py] > p` generates
`.card[data-py] > p:where([data-py="2"])`. When the attribute is absent from the selector,
the added match is wrapped in `:where()` so specificity does not change.

## Try it

`example/` is a Vite setup showing how you would ship this in practice: one stylesheet, one
page, both paths in the built CSS. Open it in different browsers and a badge tells you which
path that browser took. It should look the same either way.

It is styled with `@fylgja/base` and `@fylgja/tokens`. Neither is required by this package,
which works with any CSS.

```bash
cd example && npm install && npm run dev
```

## Integrations

All three run in combined mode, since a build pipeline expects one stylesheet in and one
stylesheet out. Use the CLI or `compile()` when you want a separate fallback file.

### Vite

```js
import attrPolyfill from "@fylgja/css-attr-polyfill/vite";

export default {
    plugins: [attrPolyfill({ content: ["src/**/*.{html,jsx,vue}"] })],
};
```

Deliberately not a `pre` plugin. Vite inlines `@import` inside its own CSS plugin, so a
`pre` plugin would only see the entry stylesheet and silently generate nothing. Running
afterwards means it sees the CSS that actually ships, whether you assemble it with `@import`
or with JavaScript imports.

### PostCSS

```js
import attrPolyfill from "@fylgja/css-attr-polyfill/postcss";

export default {
    plugins: [attrPolyfill({ content: ["src/**/*.html"] })],
};
```

Content is scanned once per build, not once per stylesheet. Warnings surface through the
PostCSS result.

### Lightning CSS

Lightning CSS parses `attr()` v2 correctly, but its visitor API models selectors as
`SelectorComponent[]` and declarations as structured values, with no escape hatch for raw
CSS text. Generated rules therefore cannot be injected from a visitor, so this integration
runs before Lightning CSS parses the stylesheet.

```js
import { preprocess } from "@fylgja/css-attr-polyfill/lightningcss";
import { transform } from "lightningcss";

const { code } = await preprocess(source, { content: ["src/**/*.html"] });

transform({ code: Buffer.from(code), filename: "utils.css", minify: true });
```
