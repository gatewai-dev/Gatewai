import { defineConfig } from "tsdown";

export default defineConfig({
	entry: {
		node: "src/node/index.ts",
		react: "src/react/index.ts",
		configs: "src/index.ts",
	},
	format: ["esm"],
	dts: true,
	clean: true,
	sourcemap: true,
	treeshake: true,
});
