import { defineConfig } from "tsdown";

export default defineConfig({
	entry: {
		index: "src/metadata.ts",
		node: "src/node.ts",
		client: "src/client.tsx",
	},
	format: ["esm"],
	dts: true,
	clean: true,
	sourcemap: true,
	treeshake: true,
	external: [
		"react",
		"react-dom",
		"@gatewai/node-sdk",
		"@gatewai/core",
		"@gatewai/db",
		"@gatewai/ui-kit",
		"zod",
	],
});
