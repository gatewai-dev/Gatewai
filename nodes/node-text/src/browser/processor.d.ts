import type { NodeResult } from "@gatewai/core/types";
import type { IBrowserProcessor } from "@gatewai/node-sdk/browser";
import type { NodeProcessorParams } from "@gatewai/react-canvas";
export declare class TextBrowserProcessor implements IBrowserProcessor {
	process({ node, context }: NodeProcessorParams): Promise<NodeResult | null>;
}
