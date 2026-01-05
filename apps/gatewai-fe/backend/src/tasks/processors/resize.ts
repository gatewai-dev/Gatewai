import { DataType } from "@gatewai/db";
import type {
	FileData,
	NodeResult,
	Output,
	OutputItem,
	ResizeNodeConfig,
} from "@gatewai/types";
import {
	applyResize,
	bufferToDataUrl,
	getImageBuffer,
	getImageDimensions,
	getMimeType,
} from "../../utils/image.js";
import { getInputValue } from "../resolvers.js";
import type { NodeProcessor } from "./types.js";

const resizeProcessor: NodeProcessor = async ({ node, data }) => {
	try {
		console.log("PROCESSING RESIZE");
		const imageInput = getInputValue(data, node.id, true, {
			dataType: DataType.Image,
			label: "Image",
		})?.data as FileData | null;
		const resizeConfig = node?.config as ResizeNodeConfig;
		const width = resizeConfig.width ?? 0;
		const height = resizeConfig.height ?? 0;

		if (!imageInput) {
			return { success: false, error: "No image input provided" };
		}

		const buffer = await getImageBuffer(imageInput);
		const processedBuffer = await applyResize(buffer, width, height);
		const mimeType = getMimeType(imageInput);
		const dataUrl = bufferToDataUrl(processedBuffer, mimeType);
		const dimensions = getImageDimensions(processedBuffer);

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

		const newGeneration: Output = {
			items: [
				{
					type: DataType.Image,
					data: { processData: { dataUrl, ...dimensions } },
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
			error: err instanceof Error ? err.message : "Resize processing failed",
		};
	}
};

export default resizeProcessor;
