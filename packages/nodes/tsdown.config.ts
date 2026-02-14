import { defineConfig } from "tsdown";

export default defineConfig({
	entry: {
		server: "src/server/index.ts",
		browser: "src/browser/index.ts",
		configs: "src/index.ts",
	},
	format: ["esm"],
	dts: true,
	clean: true,
	sourcemap: true,
	treeshake: true,
});
