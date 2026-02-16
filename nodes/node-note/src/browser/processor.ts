import type { NodeProcessorParams, NodeResult } from "@gatewai/core/types";
import type { IBrowserProcessor } from "@gatewai/node-sdk/browser";

export class NoteBrowserProcessor implements IBrowserProcessor {
	async process({ node }: NodeProcessorParams): Promise<NodeResult | null> {
		return node.result;
	}
}
