import { defineConfig } from "tsdown";

export default defineConfig({
	entry: {
		index: "src/metadata.ts",
		server: "src/server/index.ts",
		browser: "src/browser/index.tsx",
	},
	format: ["esm"],
	dts: true,
	clean: true,
	sourcemap: true,
	treeshake: true,
	external: ["react", "react-dom", "zod", "tsyringe"],
});
