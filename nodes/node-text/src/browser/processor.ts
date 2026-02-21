import type { TextResult } from "../shared/index.js";

import type { IBrowserProcessor } from "@gatewai/node-sdk/browser";
import type { NodeProcessorParams } from "@gatewai/react-canvas";
import { TextNodeConfigSchema } from "../shared/config.js";

export class TextBrowserProcessor implements IBrowserProcessor {
	async process({
		node,
		context,
	}: NodeProcessorParams): Promise<TextResult | null> {
		const outputHandle = context.getFirstOutputHandle(node.id, "Text");
		const config = TextNodeConfigSchema.parse(node.config);
		if (!outputHandle) throw new Error("No input handle");
		return {
			selectedOutputIndex: 0,
			outputs: [
				{
					items: [
						{
							type: "Text" as const,
							data: config.content ?? "",
							outputHandleId: outputHandle,
						},
					],
				},
			],
		};
	}
}
