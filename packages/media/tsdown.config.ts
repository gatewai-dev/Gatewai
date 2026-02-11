import { defineConfig } from "tsdown";

export default defineConfig({
	entry: {
		index: "src/index.ts",
		pixi: "src/pixi/index.ts",
	},
	format: ["esm"],
	dts: true,
	clean: true,
	sourcemap: true,
	treeshake: true,
});
