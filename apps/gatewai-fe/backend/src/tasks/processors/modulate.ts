import assert from "node:assert";
import { DataType } from "@gatewai/db";
import type {
	FileData,
	ModulateNodeConfig,
	NodeResult,
	Output,
} from "@gatewai/types";
import parseDataUrl from "data-urls";
import { backendPixiService } from "../../media/pixi-processor.js";
import { logImage } from "../../media-logger.js";
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
		const imageUrl =
			imageInput?.entity?.signedUrl ?? imageInput?.processData?.dataUrl;
		assert(imageUrl);
		const { dataUrl, ...dimensions } = await backendPixiService.processModulate(
			imageUrl,
			modulateConfig,
		);

		const parsed = parseDataUrl(dataUrl);
		if (parsed?.body.buffer) {
			logImage(Buffer.from(parsed?.body.buffer), ".png", node.id);
		}
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
