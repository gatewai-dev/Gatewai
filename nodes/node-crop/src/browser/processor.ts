import type {
	NodeProcessorContext,
	NodeProcessorParams,
	PixiProcessOutput,
	VirtualMediaData,
} from "@gatewai/core/types";
import type { IBrowserProcessor } from "@gatewai/node-sdk/browser";
import {
	appendOperation,
	getActiveMediaMetadata,
} from "@gatewai/remotion-compositions";
import { type CropNodeConfig, CropNodeConfigSchema } from "../shared/config.js";
import type { CropResult, VideoCropResult } from "../shared/index.js";
import { applyCrop, type PixiCropInput } from "../shared/pixi-crop-run.js";

export class CropBrowserProcessor implements IBrowserProcessor {
	async process({
		node,
		inputs,
		signal,
		context,
	}: NodeProcessorParams): Promise<CropResult | VideoCropResult | null> {
		const inputEntry = Object.values(inputs).find(
			({ connectionValid, outputItem }) =>
				connectionValid &&
				(outputItem?.type === "Image" ||
					outputItem?.type === "SVG" ||
					outputItem?.type === "Video"),
		);

		if (!inputEntry?.outputItem) {
			throw new Error("Missing input");
		}

		const config = CropNodeConfigSchema.parse(node.config);

		if (inputEntry.outputItem.type === "Video") {
			return this.processMedia(
				inputEntry.outputItem.data as VirtualMediaData,
				config,
				context,
				node.id,
			);
		} else {
			return this.processImage(inputs, config, signal, context, node.id);
		}
	}

	private async processMedia(
		inputVideo: VirtualMediaData,
		config: CropNodeConfig,
		context: NodeProcessorContext,
		nodeId: string,
	): Promise<VideoCropResult> {
		const currentMeta = getActiveMediaMetadata(inputVideo);
		const currentWidth = currentMeta?.width ?? 1920;
		const currentHeight = currentMeta?.height ?? 1080;

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

		const outputHandle = context.getFirstOutputHandle(nodeId);
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

	private async processImage(
		inputs: NodeProcessorParams["inputs"],
		config: CropNodeConfig,
		signal: AbortSignal | undefined,
		context: NodeProcessorContext,
		nodeId: string,
	): Promise<CropResult> {
		const imageUrl =
			context.findInputData(inputs, "Image") ||
			context.findInputData(inputs, "SVG");
		if (!imageUrl) throw new Error("Missing Input Image");

		const result = await context.pixi.execute<PixiCropInput, PixiProcessOutput>(
			nodeId,
			{
				imageUrl,
				config,
			},
			applyCrop,
			signal,
		);

		const outputHandle = context.getFirstOutputHandle(nodeId);
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
