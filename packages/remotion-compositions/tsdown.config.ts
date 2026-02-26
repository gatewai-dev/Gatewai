import { defineConfig } from "tsdown";

export default defineConfig({
	entry: ["src/index.ts", "src/server.ts"],
	format: ["esm"],
	dts: true,
	clean: true,
	sourcemap: true,
	treeshake: true,
});
