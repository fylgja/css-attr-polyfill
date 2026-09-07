/**
 * Every attribute name referenced by an attr() call in a stylesheet.
 *
 * Scanning is driven by the CSS, so markup is only searched for attributes that
 * actually feed a declaration.
 *
 * @param {string} css
 * @returns {Set<string>}
 */
export declare function collectAttributeNames(css: string): Set<string>;
/**
 * Pull attribute values out of source text.
 *
 * This deliberately extracts rather than parses, so one pass covers HTML, Markdown,
 * JSX, Vue, Svelte, Astro and server-side templates.
 *
 * @param {string} text
 * @param {Iterable<string>} attributeNames
 * @returns {{ values: Map<string, Set<string>>, dynamic: Set<string> }}
 */
export declare function extractAttrValues(text: string, attributeNames: Iterable<string>): {
    values: Map<string, Set<string>>;
    dynamic: Set<string>;
};
/**
 * Scan content files for the values of a set of attributes.
 *
 * @param {object} options
 * @param {string[]} options.content glob patterns, relative to cwd
 * @param {Iterable<string>} options.attributes attribute names to look for
 * @param {string} [options.cwd]
 * @returns {Promise<{ values: Map<string, Set<string>>, dynamic: Set<string>, files: number, warnings: string[] }>}
 */
export declare function scan({ content, attributes, cwd }: {
    content: string[];
    attributes: Iterable<string>;
    cwd?: string;
}): Promise<{
    values: Map<string, Set<string>>;
    dynamic: Set<string>;
    files: number;
    warnings: string[];
}>;
