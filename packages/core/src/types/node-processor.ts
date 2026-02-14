import type { DataType } from "@gatewai/db";
import type { AnyOutputItem, NodeResult } from "./node-result.js";

export type ConnectedInput = {
	connectionValid: boolean;
	outputItem: AnyOutputItem | null;
};

export interface NodeProcessorContext {
	registerObjectUrl: (url: string) => void;
	getOutputHandle: (type: string, label?: string) => string | undefined;
}

export type NodeProcessorParams<TNode = any> = {
	node: TNode;
	inputs: Record<string, ConnectedInput>;
	signal: AbortSignal;
	data: any;
	context: NodeProcessorContext;
};

export type NodeRunFunction<TNode = any> = (
	params: NodeProcessorParams<TNode>,
) => Promise<NodeResult | null>;
