# Example

A Vite setup showing how you would actually ship `attr()` v2 today: one stylesheet, written
once, with static fallbacks generated at build time behind an `@supports` guard.

Styling comes from `@fylgja/base` and `@fylgja/tokens`, so the page is a realistic Fylgja
project rather than a pile of demo CSS. The compiler itself does not depend on either;
they are here because this is the setup the tool was built for.

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

`src/utilities.css` is the only stylesheet you write. The Vite plugin compiles it in place,
so the built CSS contains both paths:

```css
@supports not (padding: attr(x type(<length>), 1px)) {
	[data-p="3"] {
		padding: calc(var(--spacing) * 3);
	}
}
[data-p] {
	padding: calc(var(--spacing) * attr(data-p type(<number>), 1));
}
```

The guard is false in modern browsers, so they skip the generated block and use `attr()`
directly, keeping its unbounded behaviour. Older browsers cannot parse the `attr()`
declaration at all, so they drop it and use the generated rule. Load order never matters.

Only the values actually present in `index.html` get generated, because the plugin is
configured with `content: ["*.html"]`.

## What each section demonstrates

- **Component**: real markup built from the utilities, several attributes on one element.
- **Spacing** and **sizing**: `type(<number>)` inside `calc()`, one attribute driving two
  properties.
- **Lengths**: values come from an `attr-polyfill:` comment in the CSS rather than scanning,
  which is how you cover values that never appear literally in markup.
- **Colours**: `type(<color>)`, including named colours.
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

The Vite plugin scans content once when it transforms a stylesheet. Changing an attribute
value in `index.html` will not regenerate the CSS until the stylesheet itself changes or
the dev server restarts. Editing `src/utilities.css` picks everything up.
