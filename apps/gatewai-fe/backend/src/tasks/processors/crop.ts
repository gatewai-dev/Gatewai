import { DataType } from "@gatewai/db";
import type {
	CropNodeConfig,
	FileData,
	NodeResult,
	Output,
	OutputItem,
} from "@gatewai/types";
import {
	applyCrop,
	bufferToDataUrl,
	getImageBuffer,
	getImageDimensions,
	getMimeType,
} from "../../utils/image.js";
import { getInputValue } from "../resolvers.js";
import type { NodeProcessor } from "./types.js";

const cropProcessor: NodeProcessor = async ({ node, data }) => {
	try {
		console.log("PROCESSING CROP");
		const imageInput = getInputValue(data, node.id, true, {
			dataType: DataType.Image,
			label: "Image",
		}) as FileData | null;
		const cropConfig = node?.config as CropNodeConfig;
		const { leftPercentage, topPercentage, widthPercentage, heightPercentage } =
			cropConfig;

		if (!imageInput) {
			return { success: false, error: "No image input provided" };
		}

		const buffer = await getImageBuffer(imageInput);
		const processedBuffer = await applyCrop(
			buffer,
			leftPercentage,
			topPercentage,
			widthPercentage,
			heightPercentage,
		);
		const mimeType = getMimeType(imageInput);
		const dimensions = getImageDimensions(processedBuffer);
		const dataUrl = bufferToDataUrl(processedBuffer, mimeType);

		// Build new result (similar to LLM)
		const outputHandle = data.handles.find(
			(h) => h.nodeId === node.id && h.type === "Output",
		);
		if (!outputHandle) throw new Error("Output handle is missing");

		const newResult: NodeResult = structuredClone(
			node.result as NodeResult,
		) ?? {
			outputs: [],
			selectedOutputIndex: 0,
		};

		const newGeneration: Output = {
			items: [
				{
					type: DataType.Image,
					data: { processData: { dataUrl, ...dimensions } }, // Transient data URL
					outputHandleId: outputHandle.id,
				} as OutputItem<"Image">,
			],
		};

		newResult.outputs.push(newGeneration);
		newResult.selectedOutputIndex = newResult.outputs.length - 1;

		return { success: true, newResult };
	} catch (err: unknown) {
		return {
			success: false,
			error: err instanceof Error ? err.message : "Crop processing failed",
		};
	}
};

export default cropProcessor;
