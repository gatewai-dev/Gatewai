import type {
	NodeProcessorParams,
	PixiProcessOutput,
} from "@gatewai/core/types";
import type { IBrowserProcessor } from "@gatewai/node-sdk/browser";
import { BlurNodeConfigSchema } from "../shared/config.js";
import type { BlurResult } from "../shared/index.js";
import { applyBlur, type PixiBlurInput } from "../shared/pixi-blur-run.js";

export class BlurBrowserProcessor implements IBrowserProcessor {
	async process({
		node,
		inputs,
		signal,
		context,
	}: NodeProcessorParams): Promise<BlurResult | null> {
		const imageUrl = context.findInputData(inputs, "Image");
		if (!imageUrl) throw new Error("Missing Input Image");

		const config = BlurNodeConfigSchema.parse(node.config);
		const result = await context.pixi.execute<PixiBlurInput, PixiProcessOutput>(
			node.id,
			{
				imageUrl,
				options: config,
			},
			applyBlur,
			signal,
		);
		const outputHandle = context.getFirstOutputHandle(node.id, "Image");
		if (!outputHandle) throw new Error("Missing output handle");

		const dataUrl = URL.createObjectURL(result.dataUrl);
		// This is required to prevent memory leak.
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
