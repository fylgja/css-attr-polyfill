# Example

A Vite setup showing how you would actually ship `attr()` v2 today: one stylesheet, written
once, with static fallbacks generated at build time behind an `@supports` guard.

Styling comes from `@fylgja/base`, `@fylgja/tokens`, `@fylgja/card` and `@fylgja/badge`, so
the page is a realistic Fylgja project rather than a pile of demo CSS. The compiler itself
does not depend on any of them; they are here because this is the setup the tool was built
for.

The utilities land on real components. A `.card` carrying `data-p` and `data-radius`
overrides the component's own padding and corner through ordinary cascade order, which is
why `utilities.css` has to be imported last.

## Run it

```bash
npm install
npm run dev
```

Then open the page in more than one browser. The badge at the top tells you which path that
browser took, using a pure CSS `@supports` test with no JavaScript:

- **native attr() v2**, in browsers that support it
- **generated fallback**, in browsers that do not

The page should look the same either way. That is the whole point.

## What ships

`src/main.css` is the entry, and `@import` order decides everything:

```css
@import "@fylgja/tokens/css/index.css";
@import "@fylgja/base/index.css";
@import "./style.css";
@import "./utilities.css";
```

Utilities come last, so their generated fallbacks land after everything they need to
override. `src/utilities.css` is the only stylesheet you write. The Vite plugin compiles it
in place, so the built CSS contains both paths:

```css
[data-p] {
	padding: calc(var(--spacing) * attr(data-p type(<number>), 1));
}
@supports not (padding: attr(x type(<length>), 1px)) {
	[data-p="6"] {
		padding: calc(var(--spacing) * 6);
	}
}
```

The guard is false in modern browsers, so they skip the generated block and use `attr()`
directly, keeping its unbounded behaviour.

The fallback comes **after** the rule it stands in for. Not every browser drops an
unsupported `attr()` declaration at parse time. Safari keeps it, so a fallback placed
earlier would lose to it and you would see nothing.

Only the values actually present in `index.html` get generated, because the plugin is
configured with `content: ["*.html"]`.

## What each section demonstrates

- **Components**: `@fylgja/card` and `@fylgja/badge` with utilities layered over their
  defaults.
- **Spacing** and **sizing**: `type(<number>)` inside `calc()`, one attribute driving two
  properties.
- **Lengths**: values come from an `attr-polyfill:` comment in the CSS rather than scanning,
  which is how you cover values that never appear literally in markup.
- **Colours**: `type(<color>)`, including named colours.
- **Strings**: badge text comes from `data-label` through legacy `attr()` on a pseudo-element.
  That already works everywhere, so it is here to show the selector handling, which inserts
  the match _before_ `::after`.
- **Media query**: the fallback is generated inside the same `@media`, not hoisted out.

## Inspect the output

```bash
npm run inspect
```

Prints the compiled stylesheet so you can read the generated rules.

## Notes

`--spacing`, `--size-*` and `--radius-*` come from `@fylgja/tokens`. The generated rules
reference custom properties but never define them, so tokens must load on every page that
uses the utilities. `src/style.css` holds only what the demo itself needs, since
`@fylgja/base` is class-less and covers typography, links, focus rings, forms and buttons.

Attribute values have to be literal. `attr(data-tint type(<color>))` needs `data-tint="#f5c542"`,
not `data-tint="var(--color-3)"`, because `var()` is not a `<color>` at parse time. The same
applies to lengths.

The card tint uses an alpha hex so it layers over whatever the card background already is.
`@fylgja/base/theme` enables `color-scheme: light dark`, and an opaque tint would keep the
inherited text colour and fail contrast in one of the two schemes.

The Vite plugin scans content once when it transforms a stylesheet. Changing an attribute
value in `index.html` will not regenerate the CSS until the stylesheet itself changes or
the dev server restarts. Editing `src/utilities.css` picks everything up.
