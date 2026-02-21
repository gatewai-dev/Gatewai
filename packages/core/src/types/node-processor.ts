import type { DataType } from "@gatewai/db";
import type { AnyOutputItem, NodeResult } from "./node-result.js";
import type { IPixiProcessor } from "./pixi.js";

export type ConnectedInput = {
	connectionValid: boolean;
	outputItem: AnyOutputItem | null;
};

export interface NodeProcessorContext {
	getFirstOutputHandle: (nodeId: string, type?: DataType) => string | undefined;
	getFirstOutputHandleWithLabel: (
		nodeId: string,
		label: string,
	) => string | undefined;
	findInputData: (
		inputs: Record<string, ConnectedInput>,
		requiredType?: string,
		handleLabel?: string,
	) => string | undefined;
	registerObjectUrl: (url: string) => void;
	getOutputHandle: (type: string, label?: string) => string | undefined;
	pixi: IPixiProcessor;
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
