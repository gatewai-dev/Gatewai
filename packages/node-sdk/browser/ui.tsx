import type { NodeResult } from "@gatewai/core/types";
import type React from "react";
import { createContext, useContext } from "react";
import type { HandleState, NodeProcessor } from "./types.js";

export interface NodeUIContextType {
	onNodeConfigUpdate: (payload: {
		id: string;
		newConfig: Record<string, any>;
		appendHistory?: boolean;
	}) => void;
	onNodeResultUpdate: (payload: { id: string; newResult: NodeResult }) => void;
	createNewHandle: (handleEntity: any) => void;
	runNodes: (nodeIds?: string[]) => Promise<void>;
	useNodeTaskRunning: (nodeId: string) => boolean;

	// Components provided by host
	BaseNode: React.ComponentType<any>;
	CanvasRenderer: React.ComponentType<
		{ imageUrl: string } & React.RefAttributes<HTMLCanvasElement>
	>;

	// Access to the graph processor engine
	processor: NodeProcessor;
}

export const NodeUIContext = createContext<NodeUIContextType | undefined>(
	undefined,
);

export const NodeUIProvider = ({
	children,
	value,
}: {
	children: React.ReactNode;
	value: NodeUIContextType;
}) => {
	return (
		<NodeUIContext.Provider value={value}>{children}</NodeUIContext.Provider>
	);
};

export function useNodeUI() {
	const ctx = useContext(NodeUIContext);
	if (!ctx) {
		throw new Error("useNodeUI must be used within a NodeUIProvider");
	}
	return ctx;
}
