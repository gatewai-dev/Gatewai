import { defineConfig } from "tsdown";

export default defineConfig({
	entry: {
		server: "server/index.ts",
		browser: "browser/index.ts",
		index: "./index.ts",
	},
	format: ["esm"],
	dts: true,
	clean: true,
	sourcemap: true,
	treeshake: true,
	external: [
		"react",
		"react-dom",
		"react/jsx-runtime",
		"@gatewai/core",
		"@gatewai/db",
		"@gatewai/media",
		"@gatewai/react-store",
		"@gatewai/ui-kit",
		"zod",
		"@hookform/resolvers",
		"react-hook-form",
		"clsx",
		"tailwind-merge",
		"lodash",
		"lucide-react",
		"react-fast-compare",
	],
});
