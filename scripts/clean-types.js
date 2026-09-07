// Removes the generated declaration files.
//
// Once they exist, TypeScript resolves `./src/transform.js` to `src/transform.d.ts`
// rather than the source, then refuses to overwrite its own input (TS5055). Clearing
// them first keeps `gen:types` repeatable.

import { readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

/**
 * @param {string} dir
 * @returns {Promise<void>}
 */
async function clean(dir) {
	for (const entry of await readdir(dir, { withFileTypes: true })) {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) await clean(path);
		else if (entry.name.endsWith(".d.ts")) await rm(path);
	}
}

await rm(join(root, "index.d.ts"), { force: true });
await clean(join(root, "src"));
