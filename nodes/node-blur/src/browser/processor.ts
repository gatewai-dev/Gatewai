import type { NodeRunFunction } from "@gatewai/core/types";
import {
	PixiProcessOutput,
	PixiProcessor,
	PixiProcessorContext,
} from "@gatewai/media/common/pixi/types";
import { type BlurNodeConfig, BlurNodeConfigSchema } from "@/shared/config.js";

const blurBrowserProcessor: NodeRunFunction = async ({
	node,
	inputs,
	signal,
	context,
	pixi,
}) => {
	const imageUrl = context.findInputData(inputs, "Image");
	if (!imageUrl) throw new Error("Missing Input Image");

	const config = BlurNodeConfigSchema.parse(node.config);
	const result = await pixi.processBlur(
		imageUrl,
		{ size: config.size ?? 1 },
		signal,
	);
	const outputHandle = context.getFirstOutputHandle(node.id, "Image");
	if (!outputHandle) throw new Error("Missing output handle");

	const dataUrl = URL.createObjectURL(result.dataUrl);
	context.registerObjectUrl(node.id, dataUrl);

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
};

export { blurBrowserProcessor };
