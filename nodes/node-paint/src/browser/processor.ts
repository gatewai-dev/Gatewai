import type { NodeProcessorParams, NodeResult } from "@gatewai/core/types";
import type { IBrowserProcessor } from "@gatewai/node-sdk/browser";
import { PaintNodeConfigSchema } from "@/shared/config.js";
import { applyPaint } from "@/shared/pixi-paint-run.js";

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

		// Extract mask from paintData if it exists (it might be a base64 string or url)
		// However, in the original code, `maskUrl` was passed.
		// Logic in node-paint typically involves the paintData being the brush strokes.
		// Let's assume paintData IS the maskUrl or we need to handle it.
		// Looking at the original mask.ts, it took maskUrl.
		// In the new system, `config.paintData` seems to be intended for the mask.
		// Let's check how the UI saves it or if there is another input.
		// The metadata shows inputs: "Background Image".
		// `paintData` is in the config.

		const maskUrl = config.paintData;

		// Note: The original mask.ts took `imageUrl` and `config` and `maskUrl`.
		// Here `config` has `paintData`.

		const result = await context.pixi.execute(
			{
				imageUrl: typeof imageUrl === "string" ? imageUrl : undefined,
				maskUrl,
			},
			config,
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
