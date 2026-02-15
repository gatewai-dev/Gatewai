import fs from "node:fs";
import path from "node:path";
import type { Plugin } from "vite";

const VIRTUAL_MODULE_ID = "virtual:gatewai-nodes";
const RESOLVED_VIRTUAL_MODULE_ID = "\0" + VIRTUAL_MODULE_ID;

export function nodeDiscovery(): Plugin {
	return {
		name: "gatewai-node-discovery",
		resolveId(id) {
			if (id === VIRTUAL_MODULE_ID) {
				return RESOLVED_VIRTUAL_MODULE_ID;
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
    metadata: () => import("${info.name}"),
    browser: () => import("${info.name}/browser"),
      server: () => Promise.resolve({ default: {} }),
    }`;
					})
					.join(",\n");

				return `export const discoveredNodes = {\n${imports}\n};`;
			}
		},
	};
}
