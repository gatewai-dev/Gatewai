/**
 * Build-time script to pre-bundle the Remotion compositions.
 *
 * Run via:  pnpm build:bundle
 * or:      tsx scripts/bundle-remotion.ts
 *
 * The output is written to dist/remotion-bundle and can be used by
 * @remotion/renderer at runtime without any bundling overhead.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const entryPoint = path.resolve(root, "src/remotion-entry.tsx");
const outDir = path.resolve(root, "dist/remotion-bundle");

console.log("[remotion-bundle] Bundling compositions...");
console.log(`  Entry: ${entryPoint}`);
console.log(`  Out:   ${outDir}`);

const bundleLocation = await bundle({
	entryPoint,
	outDir,
	rootDir: root,
	webpackOverride: (config) => {
		return {
			...config,
			resolve: {
				...config.resolve,
				alias: {
					...(config.resolve?.alias || {}),
					"@gatewai/core/browser": path.resolve(
						root,
						"../core/src/browser/index.ts",
					),
					"@gatewai/core/types": path.resolve(
						root,
						"../core/src/types/index.ts",
					),
					"@gatewai/core": path.resolve(root, "../core/src/index.ts"),
				},
				extensionAlias: {
					".js": [".ts", ".tsx", ".js"],
					".jsx": [".tsx", ".jsx"],
					".mjs": [".mts", ".mjs"],
				},
			},
			externals: {
				...((config.externals as Record<string, string>) || {}),
				"node:async_hooks": "commonjs async_hooks",
				"node:fs": "commonjs fs",
				"node:path": "commonjs path",
				"node:url": "commonjs url",
				"node:crypto": "commonjs crypto",
				"node:buffer": "commonjs buffer",
				"node:stream": "commonjs stream",
				"node:util": "commonjs util",
				"node:assert": "commonjs assert",
				"node:os": "commonjs os",
			},
		};
	},
	onProgress: (progress) => {
		if (progress % 10 === 0) {
			console.log(`  Progress: ${progress}%`);
		}
	},
});

console.log(`[remotion-bundle] Done → ${bundleLocation}`);
