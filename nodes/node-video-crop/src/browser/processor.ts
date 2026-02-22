import type {
	NodeProcessorParams,
	VirtualVideoData,
} from "@gatewai/core/types";
import type { IBrowserProcessor } from "@gatewai/node-sdk/browser";
import {
	appendOperation,
	getActiveVideoMetadata,
} from "@gatewai/remotion-compositions";
import { VideoCropConfigSchema } from "../shared/config.js";
import type { VideoCropResult } from "../shared/index.js";

export class VideoCropBrowserProcessor implements IBrowserProcessor {
	async process({
		node,
		inputs,
		context,
	}: NodeProcessorParams): Promise<VideoCropResult | null> {
		// Get VirtualVideoData from the first connected Video input
		const videoInput = Object.values(inputs).find(
			({ connectionValid, outputItem }) =>
				connectionValid && outputItem?.type === "Video",
		);

		if (!videoInput?.outputItem) {
			throw new Error("Missing Video input");
		}

		const inputVideo = videoInput.outputItem.data as VirtualVideoData;
		const config = VideoCropConfigSchema.parse(node.config);

		const currentMeta = getActiveVideoMetadata(inputVideo);
		const currentWidth = currentMeta.width ?? 1920;
		const currentHeight = currentMeta.height ?? 1080;

		const newWidth = (currentWidth * config.widthPercentage) / 100;
		const newHeight = (currentHeight * config.heightPercentage) / 100;

		const output = appendOperation(inputVideo, {
			op: "crop",
			leftPercentage: config.leftPercentage,
			topPercentage: config.topPercentage,
			widthPercentage: config.widthPercentage,
			heightPercentage: config.heightPercentage,
			metadata: {
				...currentMeta,
				width: Math.round(newWidth),
				height: Math.round(newHeight),
			},
		});

		const outputHandle = context.getFirstOutputHandle(node.id);
		if (!outputHandle) throw new Error("Missing output handle");

		return {
			selectedOutputIndex: 0,
			outputs: [
				{
					items: [
						{
							type: "Video",
							data: output,
							outputHandleId: outputHandle,
						},
					],
				},
			],
		};
	}
}
