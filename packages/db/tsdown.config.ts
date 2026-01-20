import { defineConfig } from "tsdown";

export default defineConfig({
	entry: {
		".": "src/index.ts",
	},
	format: ["esm"],
	external: [/generated\/client/],
	clean: true,
	sourcemap: true,
	treeshake: true,

	noExternal: [],
});
