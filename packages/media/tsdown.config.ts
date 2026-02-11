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
	external: [
		"@gatewai/core",
		"@pixi/node",
		"canvas",
		"sharp",
		"pixi.js",
		"@pixi/webworker",
	],
});
