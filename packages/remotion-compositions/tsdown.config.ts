import { defineConfig } from "tsdown";

export default defineConfig({
	entry: [
		"src/index.ts",
		"src/server.ts",
		"src/browser.ts",
		"src/remotion-entry.tsx",
	],
	format: ["esm"],
	dts: true,
	clean: false,
	sourcemap: true,
	treeshake: true,
});
