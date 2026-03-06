import type { IBrowserProcessor } from "@gatewai/node-sdk/browser";
import type { NodeProcessorParams } from "@gatewai/react-canvas";
import { TextMergerNodeConfigSchema } from "../shared/config.js";
import type { TextMergerResult } from "../shared/index.js";
import { joinText } from "../shared/join-fn.js";

export class TextMergerBrowserProcessor implements IBrowserProcessor {
	async process({
		inputs,
		node,
		context,
	}: NodeProcessorParams): Promise<TextMergerResult | null> {
		const config = TextMergerNodeConfigSchema.parse(node.config);
		// inputs record is already sorted by handle.createdAt due to collectInputs logic
		const allTexts = Object.values(inputs).map(
			(input) => input.outputItem?.data,
		);
		const resultText = joinText(allTexts, config.join ?? "\n");

		const outputHandle = context.getFirstOutputHandle(node.id);
		if (!outputHandle) throw new Error("Missing output handle");
		const output = {
			selectedOutputIndex: 0 as const,
			outputs: [
				{
					items: [
						{
							type: "Text" as const,
							data: resultText,
							outputHandleId: outputHandle,
						},
					],
				},
			],
		};

		return output as unknown as TextMergerResult;
	}
}
