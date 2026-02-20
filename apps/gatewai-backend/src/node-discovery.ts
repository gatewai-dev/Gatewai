import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function discoverNodes() {
	// Adjust path to reach root 'nodes' directory from:
	// apps/gatewai-fe/backend/src/graph-engine/node-discovery.ts
	// -> ../../../../nodes
	const nodesDir = path.resolve(__dirname, "../../../nodes");

	if (!fs.existsSync(nodesDir)) {
		console.warn(`Nodes directory not found at ${nodesDir}`);
		return [];
	}

	const entries = fs.readdirSync(nodesDir).filter((d) => {
		return (
			d.startsWith("node-") && fs.statSync(path.join(nodesDir, d)).isDirectory()
		);
	});

	const discovered = [];

	for (const dir of entries) {
		const pkgPath = path.join(nodesDir, dir, "package.json");
		if (fs.existsSync(pkgPath)) {
			try {
				const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));

				let entryPath = `${pkg.name}/server`;
				const isDev = process.env.NODE_ENV !== "production" || process.env.npm_lifecycle_event === "dev";
				const serverExports = pkg.exports?.["./server"];

				if (serverExports) {
					// Use the 'development' condition if in dev, else fallback to 'import' or 'default'
					const relativePath = isDev && serverExports.development
						? serverExports.development
						: (serverExports.import || serverExports.default);

					if (relativePath) {
						entryPath = "file://" + path.join(nodesDir, dir, relativePath);
					}
				}

				// We return the package name so the dynamic import uses the workspace resolution
				discovered.push({
					name: pkg.name,
					server: () => import(entryPath),
				});
			} catch (e) {
				console.warn(`Failed to parse node ${dir}:`, e);
			}
		}
	}

	return discovered;
}
