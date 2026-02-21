import type { NodeProcessorParams } from "@gatewai/core/types";
import type { IBrowserProcessor } from "@gatewai/node-sdk/browser";
import type { ExportResult } from "../shared/index.js";

export class ExportBrowserProcessor implements IBrowserProcessor {
	async process({ inputs }: NodeProcessorParams): Promise<ExportResult | null> {
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
		} as unknown as ExportResult;
	}
}
