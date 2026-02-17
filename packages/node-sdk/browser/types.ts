import type { EventEmitter } from "node:events";
import type { NodeProcessorParams, NodeResult } from "@gatewai/core/types";
import type { DataType } from "@gatewai/db";
import type { ComponentType, MemoExoticComponent } from "react";

export enum TaskStatus {
	QUEUED = "QUEUED",
	EXECUTING = "EXECUTING",
	FAILED = "FAILED",
	COMPLETED = "COMPLETED",
}

export interface HandleState {
	id: string;
	isConnected: boolean;
	valid: boolean;
	type: string | null;
	color: string | null;
}

export interface NodeState {
	id: string;
	status: TaskStatus | null;
	isDirty: boolean;
	startedAt?: number;
	finishedAt?: number;
	durationMs?: number;
	result: NodeResult | null;
	inputs: Record<string, ConnectedInput> | null;
	error: string | null;
	handleStatus: Record<string, HandleState>;
	abortController: AbortController | null;
	lastProcessedSignature: string | null;
	version: number;
}

export type ConnectedInput = {
	connectionValid: boolean;
	outputItem: {
		type: DataType;
		data: any;
		outputHandleId: string | undefined;
	} | null;
};

/**
 * Interface for the node graph processor that handles execution and state
 */
export interface NodeProcessor extends EventEmitter {
	getNodeState(nodeId: string): NodeState | null;
	getNodeResult(nodeId: string): NodeResult | null;
	getNodeValidation(nodeId: string): Record<string, string> | null;
	getHandleColor(nodeId: string, handleId: string): string | null;
	getNodeData(nodeId: string): any; // Returns NodeEntityType-like structure
}

/**
 * Frontend-specific plugin definition.
 */
export interface FrontendNodePlugin {
	/**
	 * The Reactflow custom node component
	 */
	Component: MemoExoticComponent<ComponentType<any>>;
	/**
	 * The (Form) component that shows in sidebar when node selected
	 */
	ConfigComponent?: MemoExoticComponent<ComponentType<any>>;
	/**
	 * The Page component that opens when user clicks "Page Opener Button"
	 */
	PageContentComponent?: MemoExoticComponent<ComponentType<any>>;

	mainIconComponent?: MemoExoticComponent<ComponentType<any>>;

	processor: BrowserProcessorConstructor;
}

export interface IBrowserProcessor {
	process(params: NodeProcessorParams): Promise<NodeResult | null>;
}

export type BrowserProcessorConstructor = new () => IBrowserProcessor;
