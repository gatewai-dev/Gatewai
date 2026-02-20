import fs from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";

const VIRTUAL_MODULE_ID = "virtual:gatewai-nodes";
const RESOLVED_VIRTUAL_MODULE_ID = "\0" + VIRTUAL_MODULE_ID;

export function nodeDiscovery(): Plugin {
	return {
		name: "gatewai-node-discovery",
		enforce: "pre",
		async resolveId(id, importer, options) {
			if (id === VIRTUAL_MODULE_ID) {
				return RESOLVED_VIRTUAL_MODULE_ID;
			}

			const feSrcDir = path.resolve(__dirname, "../src");

			if (
				id.startsWith(feSrcDir) &&
				importer &&
				importer.includes("/nodes/node-")
			) {
				const match = importer.match(/.*\/nodes\/(node-[^/]+)\//);
				if (match) {
					const nodeName = match[1];
					const nodesDir = path.resolve(__dirname, "../../../nodes");
					const relativePath = id.slice(feSrcDir.length); // e.g. "/metadata.js" or "/utils/foo.js"

					let targetPath = path.join(nodesDir, nodeName, "src", relativePath);
					// Strip .js extension since the actual files are .ts/.tsx
					if (targetPath.endsWith(".js")) {
						targetPath = targetPath.slice(0, -3);
					}

					const resolved = await this.resolve(targetPath, importer, {
						skipSelf: true,
						...options,
					});
					if (resolved) {
						return resolved.id;
					}
					return targetPath;
				}
			}
		},
		load(id) {
			if (id === RESOLVED_VIRTUAL_MODULE_ID) {
				const nodesDir = path.resolve(__dirname, "../../../nodes");
				const entries = fs.readdirSync(nodesDir).filter((d) => {
					return (
						d.startsWith("node-") &&
						fs.statSync(path.join(nodesDir, d)).isDirectory()
					);
				});

				const nodes: Record<
					string,
					{
						name: string;
						type: string;
						paths: { metadata: string; browser: string; server: string };
					}
				> = {};

				for (const dir of entries) {
					const pkgPath = path.join(nodesDir, dir, "package.json");
					const metadataPath = path.join(nodesDir, dir, "src/metadata.ts");

					if (fs.existsSync(pkgPath) && fs.existsSync(metadataPath)) {
						try {
							const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
							const metadataContent = fs.readFileSync(metadataPath, "utf-8");
							const typeMatch = metadataContent.match(
								/type:\s*["']([^"']+)["']/,
							);

							let browserPath = path.join(
								nodesDir,
								dir,
								"src/browser/index.tsx",
							);
							if (!fs.existsSync(browserPath)) {
								browserPath = path.join(nodesDir, dir, "src/browser/index.ts");
							}

							let serverPath = path.join(nodesDir, dir, "src/server/index.ts");
							if (!fs.existsSync(serverPath)) {
								serverPath = path.join(nodesDir, dir, "src/server/index.tsx");
							}

							if (typeMatch && typeMatch[1] && fs.existsSync(browserPath)) {
								const type = typeMatch[1];
								nodes[type] = {
									name: pkg.name,
									type,
									paths: {
										metadata: metadataPath,
										browser: browserPath,
										server: serverPath,
									},
								};
							}
						} catch (e) {
							console.warn(`Failed to parse node ${dir}:`, e);
						}
					}
				}

				const imports = Object.entries(nodes)
					.map(([type, info]) => {
						return `  "${type}": {
    metadata: () => import("${info.paths.metadata}"),
    browser: () => import("${info.paths.browser}"),
      server: () => Promise.resolve({ default: {} }),
    }`;
					})
					.join(",\n");

				return `export const discoveredNodes = {\n${imports}\n};`;
			}
		},
	};
}
