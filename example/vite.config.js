import { defineConfig } from "vite";
import attrPolyfill from "@fylgja/css-attr-polyfill/vite";

export default defineConfig({
	plugins: [
		attrPolyfill({
			// Values are read straight out of the page, so only what the markup actually
			// uses gets generated.
			content: ["*.html"],
		}),
	],
});
