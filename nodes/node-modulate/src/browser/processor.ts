import type { NodeProcessorParams, NodeResult } from "@gatewai/core/types";
import type { IBrowserProcessor } from "@gatewai/node-sdk/browser";
import { ModulateNodeConfigSchema } from "@/shared/config.js";
import { applyModulate } from "@/shared/pixi-modulate-run.js";

export class ModulateBrowserProcessor implements IBrowserProcessor {
	async process({
		node,
		inputs,
		signal,
		context,
	}: NodeProcessorParams): Promise<NodeResult | null> {
		const imageUrl = context.findInputData(inputs, "Image");
		if (!imageUrl) throw new Error("Missing Input Image");

		if (typeof imageUrl !== "string") throw new Error("Invalid Input Image");

		const config = ModulateNodeConfigSchema.parse(node.config);

		const result = await context.pixi.execute(
			imageUrl,
			config,
			applyModulate,
			signal,
		);

		const outputHandle = context.getFirstOutputHandle(node.id, "Result");
		if (!outputHandle) throw new Error("Missing output handle");

		const dataUrl = URL.createObjectURL(result.dataUrl);
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
