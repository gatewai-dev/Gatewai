import type { NodeProcessorParams, NodeResult } from "@gatewai/core/types";
import type { IBrowserProcessor } from "@gatewai/node-sdk/browser";
import { CropNodeConfigSchema } from "@/shared/config.js";
import { applyCrop } from "@/shared/pixi-crop-run.js";

export class CropBrowserProcessor implements IBrowserProcessor {
	async process({
		node,
		inputs,
		signal,
		context,
	}: NodeProcessorParams): Promise<NodeResult | null> {
		const imageUrl = context.findInputData(inputs, "Image");
		if (!imageUrl) throw new Error("Missing Input Image");

		const config = CropNodeConfigSchema.parse(node.config);
		const result = await context.pixi.execute(
			imageUrl,
			config,
			applyCrop,
			signal,
		);
		const outputHandle = context.getFirstOutputHandle(node.id);
		if (!outputHandle) throw new Error("Missing output handle");

		const dataUrl = URL.createObjectURL(result.dataUrl);
		// This is required to prevent memory leakbrowser.
		context.registerObjectUrl(dataUrl);

		return {
			selectedOutputIndex: 0,
			outputs: [
				{
					items: [
						{
							type: "Image",
							data: {
								processData: {
									dataUrl,
									width: result.width,
									height: result.height,
								},
							},
							outputHandleId: outputHandle,
						},
					],
				},
			],
		};
	}
}
