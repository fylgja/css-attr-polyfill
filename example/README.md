# Example

A Vite setup showing `attr()` v2 compiled to static fallbacks, with a side by side
comparison so you can see the generated CSS doing real work.

## Run it

```bash
npm install
npm run dev
```

## The two pages

| Page           | Loads                                       | Shows                                                                          |
| -------------- | ------------------------------------------- | ------------------------------------------------------------------------------ |
| `/index.html`  | `src/utilities.css` through the Vite plugin | What your browser actually does. In Chrome that is native `attr()` v2.         |
| `/static.html` | only the compiled output                    | What a browser without `attr()` v2 gets, forced on so you can see it anywhere. |

Both pages render the same markup from `src/demo.js`. **If they look identical, the
compiler did its job.** The badge at the top of each page tells you which path you are
looking at, using a pure CSS `@supports` test with no JavaScript.

`static.html` is built by the CLI in split mode, with the guard condition overridden to
something always true so the fallback applies even in a modern browser:

```bash
css-attr-polyfill src/utilities.css --split \
  --fallback-out src/generated/static-only.css \
  --supports "(padding: 1px)" -c "*.html" -c "src/**/*.js"
```

## What each section demonstrates

- **Spacing** and **sizing**: `type(<number>)` inside `calc()`, one attribute driving two
  properties, values discovered by scanning the markup.
- **Lengths**: values come from an `attr-polyfill:` comment in the CSS, not from scanning.
- **Colours**: `type(<color>)`, including named colours.
- **Strings**: legacy `attr()` on a pseudo-element. This already works everywhere, so it is
  here to show the selector handling, which inserts the match _before_ `::after`.
- **Media query**: the fallback is generated inside the same `@media`, not hoisted out.

## Inspect the output

```bash
npm run inspect
```

Prints the compiled stylesheet to stdout so you can read the generated rules. Note that
`:root` tokens live in `src/tokens.css`, separate from the utilities, because the fallback
stylesheet contains only generated rules and not the custom properties they reference.

## Known limitation

The Vite plugin scans content once when it transforms a stylesheet. Changing an attribute
value in `src/demo.js` or a page will not regenerate the CSS until the stylesheet itself
changes or the dev server restarts. Editing `src/utilities.css` picks everything up.
