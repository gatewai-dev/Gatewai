import type { NodeResult } from "@gatewai/core/types";
import type { IBrowserProcessor } from "@gatewai/node-sdk/browser";
import type { NodeProcessorParams } from "@gatewai/react-canvas";

import type { PreviewResult } from "../shared/index.js";

export class PreviewBrowserProcessor implements IBrowserProcessor {
	async process({
		inputs,
	}: NodeProcessorParams): Promise<PreviewResult | null> {
		const inputEntries = Object.entries(inputs);
		if (inputEntries.length === 0) throw new Error("Preview disconnected");
		const [_, { outputItem }] = inputEntries[0];
		if (!outputItem) throw new Error("No input item");
		return {
			selectedOutputIndex: 0,
			outputs: [
				{
					items: [
						{
							type: outputItem.type,
							data: outputItem.data,
							outputHandleId: undefined,
						},
					],
				},
			],
		} as unknown as NodeResult;
	}
}
