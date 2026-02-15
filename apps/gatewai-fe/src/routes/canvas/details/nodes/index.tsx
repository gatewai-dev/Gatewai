import { discoveredNodes } from "virtual:gatewai-nodes";
import { lazy } from "react";

// Node types mapping
const nodeTypes: Record<string, any> = {};

// Merge registered nodes into nodeTypes
Object.entries(discoveredNodes).forEach(([type, entry]) => {
	nodeTypes[type] = lazy(async () => {
		const mod = await entry.browser();
		return { default: mod.default.Component };
	});
});

export { nodeTypes };
