import { defineConfig } from "tsdown";

export default defineConfig({
	entry: {
		index: "src/index.ts",
	},
	format: ["esm"],
	dts: true, // Create types
	clean: true, // Clean dist folder before build
	sourcemap: true, // Helpful for debugging
	treeshake: true, // Remove unused code
});
