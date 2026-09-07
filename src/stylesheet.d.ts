/**
 * A minimal, dependency free CSS reader.
 *
 * It records source offsets rather than building a document that has to be written back
 * out, so a transform can splice new text in and leave every other byte exactly as the
 * author wrote it. It understands only as much CSS as this package needs: nesting,
 * at-rules, declarations, comments, strings and parentheses.
 */
export type Declaration = {
    type: "declaration";
    prop: string;
    value: string;
    start: number;
    end: number;
};
export type Rule = {
    type: "rule";
    selector: string;
    nodes: Node[];
    /**
     * offset of the first character of the selector
     */
    start: number;
    /**
     * offset just past the closing brace
     */
    end: number;
};
export type AtRule = {
    type: "atrule";
    /**
     * without the leading `@`
     */
    name: string;
    params: string;
    nodes: Node[];
    start: number;
    end: number;
};
export type Comment = {
    type: "comment";
    text: string;
    start: number;
    end: number;
};
export type Node = Declaration | Rule | AtRule | Comment;
/**
 * Read a stylesheet into nodes carrying source offsets.
 *
 * @param {string} css
 * @returns {Node[]}
 */
export declare function parseStylesheet(css: string): Node[];
/**
 * Visit every style rule, deepest ancestry first, passing the at-rules enclosing it.
 *
 * @param {Node[]} nodes
 * @param {(rule: Rule, ancestry: AtRule[]) => void} visit
 * @param {AtRule[]} [ancestry]
 */
export declare function walkRules(nodes: Node[], visit: (rule: Rule, ancestry: AtRule[]) => void, ancestry?: AtRule[]): void;
/**
 * Collect every comment in a stylesheet, at any depth.
 *
 * @param {Node[]} nodes
 * @returns {string[]}
 */
export declare function collectComments(nodes: Node[]): string[];
/**
 * The whitespace a node sits behind on its own line, used to indent generated output.
 *
 * @param {string} css
 * @param {number} start
 * @returns {string}
 */
export declare function indentAt(css: string, start: number): string;
/**
 * Guess the indentation a stylesheet uses, so generated rules match the file they join.
 *
 * Measured from the first declaration that sits inside a rule, rather than from raw text,
 * so an aligned block comment cannot be mistaken for the file's indentation.
 *
 * @param {string} css
 * @param {Node[]} nodes the same stylesheet, already parsed
 * @returns {string} one indentation level, defaulting to two spaces
 */
export declare function detectIndentUnit(css: string, nodes: Node[]): string;
