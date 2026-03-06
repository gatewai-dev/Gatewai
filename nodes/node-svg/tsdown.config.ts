import { defineConfig } from "tsdown";

export default defineConfig({
	entry: [
		"./src/metadata.ts",
		"./src/server/index.ts",
		"./src/browser/index.ts",
	],
	format: ["esm"],
	dts: true,
	clean: true,
	sourcemap: true,
});
