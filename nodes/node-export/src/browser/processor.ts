import type { NodeProcessorParams, NodeResult } from "@gatewai/core/types";
import type { IBrowserProcessor } from "@gatewai/node-sdk/browser";

export class ModulateBrowserProcessor implements IBrowserProcessor {
	async process({ inputs }: NodeProcessorParams): Promise<NodeResult | null> {
		const inputEntries = Object.entries(inputs);
		if (inputEntries.length === 0) throw new Error("Missing input for Export");

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
