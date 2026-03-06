import { defineConfig } from "tsdown";

export default defineConfig({
	entry: {
		index: "src/index.ts",
		types: "src/types.ts",
	},
	format: ["esm"],
	clean: true,
	sourcemap: true,
	treeshake: true,
	dts: true,
	noExternal: [/^@prisma\/client/],
});
