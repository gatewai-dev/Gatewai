import { DataType } from "@gatewai/db";
import type {
	BlurNodeConfig,
	BlurResult,
	FileData,
	NodeResult,
} from "@gatewai/types";
import { logImage } from "../../media-logger.js";
import {
	applyBlur,
	bufferToDataUrl,
	getImageBuffer,
	getImageDimensions,
	getMimeType,
} from "../../utils/image.js";
import { getInputValue } from "../resolvers.js";
import type { NodeProcessor } from "./types.js";

const blurProcessor: NodeProcessor = async ({ node, data }) => {
	try {
		const imageInput = getInputValue(data, node.id, true, {
			dataType: DataType.Image,
			label: "Image",
		})?.data as FileData | null;
		const blurConfig = node.config as BlurNodeConfig;
		const blurAmount = blurConfig.size ?? 0;

		if (!imageInput) {
			return { success: false, error: "No image input provided" };
		}

		const buffer = await getImageBuffer(imageInput);
		const processedBuffer = await applyBlur(buffer, blurAmount);
		const dimensions = getImageDimensions(processedBuffer);
		const mimeType = getMimeType(imageInput);
		const dataUrl = bufferToDataUrl(processedBuffer, mimeType);
		logImage(processedBuffer, undefined, node.id);
		// Build new result (similar to LLM)
		const outputHandle = data.handles.find(
			(h) => h.nodeId === node.id && h.type === "Output",
		);
		if (!outputHandle)
			return { success: false, error: "Output handle is missing." };

		const newResult: NodeResult = structuredClone(
			node.result as NodeResult,
		) ?? {
			outputs: [],
			selectedOutputIndex: 0,
		};

		const newGeneration: BlurResult["outputs"][number] = {
			items: [
				{
					type: DataType.Image,
					data: { processData: { dataUrl, ...dimensions } },
					outputHandleId: outputHandle.id,
				},
			],
		};

		newResult.outputs.push(newGeneration);
		newResult.selectedOutputIndex = newResult.outputs.length - 1;

		return { success: true, newResult };
	} catch (err: unknown) {
		return {
			success: false,
			error: err instanceof Error ? err.message : "Blur processing failed",
		};
	}
};

export default blurProcessor;
