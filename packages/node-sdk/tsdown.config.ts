import { defineConfig } from "tsdown";

export default defineConfig({
	entry: {
		server: "server/index.ts",
		browser: "browser/index.ts",
		index: "./index.ts",
	},
	format: ["esm"],
	dts: true,
	clean: true,
	sourcemap: true,
	treeshake: true,
});
