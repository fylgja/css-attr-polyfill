# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- TypeScript declarations, generated from the JSDoc in the source and shipped
  for every entry point, so importing the package or any adapter no longer
  falls back to `any`.
  Added a `gen:types` script to regenerate them.

### Changed

- `compile()` and the Lightning CSS and PostCSS adapters described their options
  as a plain object, which gave consumers no type information.
  They now share the `TransformOptions` and `CompileOptions` shapes.

## [0.1.2] - 2026-09-07

### Added

- Documentation for the config file, which was never described.
  Every option except the input path and `--quiet` can live in it.

### Changed

- `--split` now writes the fallback to `--output`.

- `output` can be set in the config file, like every other option.

### Removed

- `--fallback-out`.
  Split mode returns the source untouched, so the second destination only ever
  held a copy of the input file.

## [0.1.1] - 2026-09-07

### Fixed

- `--config` failed on JSON files with `ERR_IMPORT_ATTRIBUTE_MISSING`, even
  though JSON configs were documented.
  Malformed and unreadable config files now report an error instead of a
  stack trace.

## [0.1.0] - 2026-09-06

First release.

### Added

- A compiler that turns CSS `attr()` v2 into static fallback rules, guarded by
  `@supports` so only one path is ever live.
  Values come from content scanning, a config safelist, and `attr-polyfill:`
  comments in the CSS.

- Combined and split output modes, a CLI, and PostCSS, Lightning CSS and Vite
  integrations.

[unreleased]: https://github.com/fylgja/css-attr-polyfill/compare/0.1.2...HEAD
[0.1.2]: https://github.com/fylgja/css-attr-polyfill/compare/0.1.1...0.1.2
[0.1.1]: https://github.com/fylgja/css-attr-polyfill/compare/0.1.0...0.1.1
[0.1.0]: https://github.com/fylgja/css-attr-polyfill/releases/tag/0.1.0
