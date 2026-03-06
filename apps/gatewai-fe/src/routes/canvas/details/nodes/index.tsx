import { discoveredNodes } from "virtual:gatewai-nodes";
import type {
	NodeIconEntry,
	NodePricingFn,
	NodeRegistryValue,
} from "@gatewai/react-canvas";
import type { ComponentType, MemoExoticComponent } from "react";
import { PiCube } from "react-icons/pi";

/**
 * Eagerly resolves all discovered node browser modules and builds the
 * registry maps: nodeTypes, iconMap, configMap, pageMap, and pricingMap.
 *
 * Must be called (and awaited) before the canvas UI renders.
 */
export async function initNodeRegistry(): Promise<NodeRegistryValue> {
	const nodeTypes: Record<string, MemoExoticComponent<ComponentType<any>>> = {};
	const iconMap: Record<string, NodeIconEntry> = {};
	const configMap: Record<string, ComponentType<any>> = {};
	const pageMap: Record<string, ComponentType<any>> = {};
	const pricingMap: Record<string, NodePricingFn> = {};

	// We'll use PiCube as a fallback for everything initially
	const fallbackIcon = { mainIcon: PiCube };

	await Promise.all(
		Object.entries(discoveredNodes).map(async ([type, entry]) => {
			const mod = await entry.browser();
			const plugin = mod.default;

			// 1. Component (nodeTypes)
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

			// 5. Pricing (pricingMap) — spread from metadata via defineClient
			const pricingFn = plugin.pricing;
			if (typeof pricingFn === "function") {
				pricingMap[type] = pricingFn;
			}
		}),
	);

	return {
		nodeTypes,
		iconMap,
		configMap,
		pageMap,
		pricingMap,
	} as unknown as NodeRegistryValue;
}
