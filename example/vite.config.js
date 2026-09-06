import { defineConfig } from "vite";
import attrPolyfill from "@fylgja/css-attr-polyfill/vite";

export default defineConfig({
	plugins: [
		attrPolyfill({
			// Values are read straight out of the demo pages, so only what the markup
			// actually uses is generated.
			content: ["*.html", "src/**/*.js"],
		}),
	],
	build: {
		rollupOptions: {
			input: {
				main: "index.html",
				static: "static.html",
			},
		},
	},
});
