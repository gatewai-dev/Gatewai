import { discoveredNodes } from "virtual:gatewai-nodes";
import type { NodeIconEntry, NodeRegistryValue } from "@gatewai/react-canvas";
import type { ComponentType } from "react";
import { PiCube } from "react-icons/pi";

/**
 * Eagerly resolves all discovered node browser modules and builds the three
 * registry maps: nodeTypes, iconMap, and configMap.
 *
 * Must be called (and awaited) before the canvas UI renders.
 */
export async function initNodeRegistry(): Promise<NodeRegistryValue> {
	const nodeTypes = {};
	const iconMap: Record<string, NodeIconEntry> = {};
	const configMap: Record<string, ComponentType<any>> = {};
	const pageMap: Record<string, ComponentType<any>> = {};

	// We'll use PiCube as a fallback for everything initially
	const fallbackIcon = { mainIcon: PiCube };

	await Promise.all(
		Object.entries(discoveredNodes).map(async ([type, entry]) => {
			const mod = await entry.browser();
			const plugin = mod.default;

			// 1. Component (nodeTypes)
			// wrapping in lazy (even though we loaded it) to match ReactFlow expectation or just direct?
			// ReactFlow nodeTypes values are components. Since we loaded it, we can pass it directly.
			// But wait, the previous code was using lazy() for nodeTypes to avoid loading all at start.
			// But here we ARE loading all at start (initNodeRegistry).
			// So we can just use the component directly.
			nodeTypes[type] = plugin.Component;

			// 2. Icon (iconMap)
			if (plugin.mainIconComponent) {
				iconMap[type] = { mainIcon: plugin.mainIconComponent };
			} else {
				iconMap[type] = fallbackIcon;
			}

			// 3. Config (configMap)
			if (plugin.ConfigComponent) {
				configMap[type] = plugin.ConfigComponent;
			}

			// 4. Page (pageMap)
			if (plugin.PageContentComponent) {
				pageMap[type] = plugin.PageContentComponent;
			}
		}),
	);

	return { nodeTypes, iconMap, configMap, pageMap };
}
