import type { NodeProcessorParams, NodeResult } from "@gatewai/core/types";
import type { IBrowserProcessor } from "@gatewai/node-sdk/browser";
import { PaintNodeConfigSchema } from "@/shared/config.js";
import {
	applyPaint,
	type PixiPaintInput,
	type PixiPaintOutput,
} from "@/shared/pixi-paint-run.js";

export class PaintBrowserProcessor implements IBrowserProcessor {
	async process({
		node,
		inputs,
		signal,
		context,
	}: NodeProcessorParams): Promise<NodeResult | null> {
		const imageUrl = context.findInputData(inputs, "Background Image");

		// Parse config
		const config = PaintNodeConfigSchema.parse(node.config);

		const result = await context.pixi.execute<PixiPaintInput, PixiPaintOutput>(
			"mask",
			{
				imageUrl: typeof imageUrl === "string" ? imageUrl : undefined,
				...config,
			},
			applyPaint,
			signal,
		);

		const imageOutputHandle = context.getFirstOutputHandle(node.id, "Image");
		const maskOutputHandle = context.getFirstOutputHandle(node.id, "Mask");

		if (!imageOutputHandle || !maskOutputHandle)
			throw new Error("Missing output handles");

		const imageWithMaskUrl = URL.createObjectURL(result.imageWithMask.dataUrl);
		const onlyMaskUrl = URL.createObjectURL(result.onlyMask.dataUrl);

		context.registerObjectUrl(imageWithMaskUrl);
		context.registerObjectUrl(onlyMaskUrl);

		return {
			selectedOutputIndex: 0,
			outputs: [
				{
					items: [
						{
							type: "Image",
							data: {
								processData: {
									dataUrl: imageWithMaskUrl,
									width: result.imageWithMask.width,
									height: result.imageWithMask.height,
								},
							},
							outputHandleId: imageOutputHandle,
						},
					],
				},
				{
					items: [
						{
							type: "Image",
							data: {
								processData: {
									dataUrl: onlyMaskUrl,
									width: result.onlyMask.width,
									height: result.onlyMask.height,
								},
							},
							outputHandleId: maskOutputHandle,
						},
					],
				},
			],
		};
	}
}
