import type { ComponentType, FC, MemoExoticComponent } from "react";
import { createContext, useContext, useMemo } from "react";

export type NodeIconEntry = {
	mainIcon: FC<{ className?: string }>;
};

export type NodePricingFn = (config: unknown) => number;

export type NodeRegistryValue = {
	nodeTypes: Record<string, any>;
	iconMap: Record<string, NodeIconEntry>;
	configMap: Record<string, MemoExoticComponent<ComponentType<any>>>;
	pageMap: Record<string, MemoExoticComponent<ComponentType<any>>>;
	pricingMap: Record<string, NodePricingFn>;
};

const NodeRegistryContext = createContext<NodeRegistryValue | null>(null);

export function NodeRegistryProvider({
	value,
	children,
}: {
	value: NodeRegistryValue;
	children: React.ReactNode;
}) {
	return (
		<NodeRegistryContext.Provider value={value}>
			{children}
		</NodeRegistryContext.Provider>
	);
}

export function useNodeRegistry() {
	const ctx = useContext(NodeRegistryContext);
	if (!ctx)
		throw new Error("useNodeRegistry must be used within NodeRegistryProvider");
	return ctx;
}

export function useNodeIcon(type: string): NodeIconEntry | null {
	const { iconMap } = useNodeRegistry();
	return iconMap[type] ?? null;
}

export function useNodeConfigComponent(type: string) {
	const { configMap } = useNodeRegistry();
	return configMap[type] ?? null;
}

export function useNodePageComponent(type: string) {
	const { pageMap } = useNodeRegistry();
	return pageMap[type] ?? null;
}

/**
 * Get the token cost for a specific node given its type and config.
 */
export function useNodePricing(type: string, config: unknown): number {
	const { pricingMap } = useNodeRegistry();
	return useMemo(() => {
		const pricingFn = pricingMap[type];
		if (!pricingFn) return 0;
		try {
			return pricingFn(config);
		} catch {
			return 0;
		}
	}, [pricingMap, type, config]);
}
