/**
 * Vite plugin that compiles attr() v2 into static fallback rules.
 *
 * Deliberately runs without `enforce: "pre"`. Vite inlines `@import` inside its own CSS
 * plugin, so a pre plugin would only ever see the entry stylesheet, before any imported
 * file had been pulled in. Running afterwards means this sees the CSS that will actually
 * ship, however it was assembled.
 *
 * @param {import("../compile.js").CompileOptions & { include?: RegExp }} [options]
 *   `include` decides which module ids to process, defaulting to .css files
 * @returns {import("vite").Plugin}
 */
export declare function attrPolyfill(options?: import("../compile.js").CompileOptions & {
    include?: RegExp;
}): import("vite").Plugin;
export default attrPolyfill;
