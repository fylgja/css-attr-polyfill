export type AttrType = {
    kind: "syntax";
    syntax: string;
} | {
    kind: "unit";
    unit: string;
} | {
    kind: "raw-string";
} | {
    kind: "string";
};
export type AttrRef = {
    /**
     * attribute name, e.g. "data-py"
     */
    name: string;
    /**
     * declared substitution type
     */
    type: AttrType;
    /**
     * source text of the fallback argument
     */
    fallback: string | null;
    /**
     * position among the attr() calls in the declaration value
     */
    index: number;
    /**
     * reason this reference cannot be compiled
     */
    unsupported: string | null;
};
/**
 * Locate and describe every attr() call in a declaration value.
 *
 * @param {string} value declaration value source text
 * @returns {AttrRef[]}
 */
export declare function parseAttrRefs(value: string): AttrRef[];
/**
 * Rewrite one attr() call in a declaration value, leaving the rest of the value untouched.
 *
 * @param {string} value declaration value source text
 * @param {number} index which attr() call to replace
 * @param {string} substitution CSS token sequence to put in its place
 * @returns {string}
 */
export declare function substituteAttr(value: string, index: number, substitution: string): string;
