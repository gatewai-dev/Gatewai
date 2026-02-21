import type { ComponentType, FC, MemoExoticComponent } from "react";
import { createContext, useContext } from "react";

export type NodeIconEntry = {
	mainIcon: FC<{ className?: string }>;
};

export type NodeRegistryValue = {
	nodeTypes: Record<string, any>;
	iconMap: Record<string, NodeIconEntry>;
	configMap: Record<string, MemoExoticComponent<ComponentType<any>>>;
	pageMap: Record<string, MemoExoticComponent<ComponentType<any>>>;
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
