/**
 * PostCSS plugin that compiles attr() v2 into static fallback rules.
 *
 * A PostCSS plugin transforms one stylesheet into one stylesheet, so this always uses
 * combined output. Use the CLI or `compile()` when you want a separate fallback file.
 *
 * @param {import("../compile.js").CompileOptions} [options]
 * @returns {import("postcss").Plugin}
 */
export declare function attrPolyfill(options?: import("../compile.js").CompileOptions): import("postcss").Plugin;
export declare namespace attrPolyfill {
    var _a: boolean;
    export { _a as postcss };
}
export default attrPolyfill;
