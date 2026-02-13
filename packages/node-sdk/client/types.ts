import type { NodeResult } from "@gatewai/core";
import type { DataType } from "@gatewai/db";

import type { ComponentType, MemoExoticComponent } from "react";
/**
 * Represents a connected input value for a frontend processor.
 */
export interface FrontendConnectedInput {
	connectionValid: boolean;
	outputItem: {
		type: DataType;
		data: unknown;
		outputHandleId: string | undefined;
	} | null;
}

/**
 * Parameters passed to a frontend node processor.
 */
export interface FrontendNodeProcessorParams {
	node: {
		id: string;
		type: string;
		config: unknown;
		result: unknown;
		[key: string]: unknown;
	};
	inputs: Record<string, FrontendConnectedInput>;
	signal: AbortSignal;
}

/**
 * Frontend processor function signature.
 * Used for lightweight client-side processing (e.g., blur preview, crop, resize).
 */
export type FrontendNodeProcessor = (
	params: FrontendNodeProcessorParams,
) => Promise<NodeResult | null>;

/**
 * Frontend-specific plugin definition.
 */
export interface FrontendNodePlugin extends NodeMetadata {
	frontendProcessor?: FrontendNodeProcessor;
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
}
