import { defineConfig } from "tsdown";

export default defineConfig({
	entry: {
		index: "common/index.ts",
		server: "server/index.ts",
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
