import type { NodeResult } from "@gatewai/core/types";
import type React from "react";
import { createContext, useContext } from "react";

export interface NodeUIContextType {
	onNodeConfigUpdate: (payload: {
		id: string;
		newConfig: Record<string, any>;
		appendHistory?: boolean;
	}) => void;
	onNodeResultUpdate: (payload: { id: string; newResult: NodeResult }) => void;
	useNodePreview: (nodeId: string) => {
		imageUrl: string | null;
		node: any;
		result: NodeResult | null;
		hasMoreThanOneOutput: boolean;
	};
	useNodeResult: (nodeId: string) => {
		result: NodeResult | null;
		inputs: Record<string, any>;
		handleStatus: Record<string, any>;
		error: string | null;
		isProcessed: boolean;
	};
	useNodeValidation: (nodeId: string) => Record<string, string>;
	// Components provided by host
	BaseNode: React.ComponentType<any>;
	CanvasRenderer: React.ComponentType<{ imageUrl: string }>;
}

export const NodeUIContext = createContext<NodeUIContextType | undefined>(
	undefined,
);

export function useNodeUI() {
	const ctx = useContext(NodeUIContext);
	if (!ctx) {
		throw new Error("useNodeUI must be used within a NodeUIProvider");
	}
	return ctx;
}
