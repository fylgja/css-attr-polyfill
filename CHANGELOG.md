# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2026-09-07

First release.

### Added

- A compiler that turns CSS `attr()` v2 into static fallback rules, guarded by
  `@supports` so only one path is ever live.
  Modern browsers keep the original declaration and its unbounded behaviour,
  everything else gets the generated rules.

- Values come from three sources, combined: scanning your content, a config
  safelist, and `attr-polyfill:` comments in the CSS itself.
  Scanning covers HTML, Markdown, JSX, TSX, Vue, Svelte, Astro and server side
  templates, and reports attributes it cannot resolve statically.

- Combined and split output modes.
  Combined splices each fallback in after its source rule and preserves every
  byte it does not touch.
  Split returns the fallbacks as a separate stylesheet, mirroring any `@layer`,
  `@media` or `@container` nesting.

- A CLI, with every option except the input path also available in a JS or JSON
  config file.

- PostCSS, Lightning CSS and Vite integrations.

- TypeScript declarations for the package and every adapter, generated from the
  JSDoc in the source.

[unreleased]: https://github.com/fylgja/css-attr-polyfill/compare/1.0.0...HEAD
[1.0.0]: https://github.com/fylgja/css-attr-polyfill/releases/tag/1.0.0
