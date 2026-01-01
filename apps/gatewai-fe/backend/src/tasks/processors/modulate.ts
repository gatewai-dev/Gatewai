import { DataType } from "@gatewai/db";
import type {
	FileData,
	ModulateNodeConfig,
	NodeResult,
	Output,
} from "@gatewai/types";
import { logMedia } from "../../media-logger.js";
import {
	applyModulate,
	bufferToDataUrl,
	getImageBuffer,
	getImageDimensions,
	getMimeType,
} from "../../utils/image.js";
import { getInputValue } from "../resolvers.js";
import type { NodeProcessor } from "./types.js";

const modulateProcessor: NodeProcessor = async ({ node, data }) => {
	try {
		const imageInput = getInputValue(data, node.id, true, {
			dataType: DataType.Image,
			label: "Image",
		})?.data as FileData | null;
		const modulateConfig = node.config as ModulateNodeConfig;

		if (!imageInput) {
			return { success: false, error: "No image input provided" };
		}

		const buffer = await getImageBuffer(imageInput);
		const processedBuffer = await applyModulate(buffer, modulateConfig);
		const mimeType = getMimeType(imageInput);
		const dimensions = getImageDimensions(processedBuffer);
		const dataUrl = bufferToDataUrl(processedBuffer, mimeType);
		logMedia(processedBuffer, undefined, node.id);
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
				},
			],
		};

		newResult.outputs.push(newGeneration);

		return { success: true, newResult };
	} catch (err: unknown) {
		return {
			success: false,
			error: err instanceof Error ? err.message : "Blur processing failed",
		};
	}
};

export default modulateProcessor;
