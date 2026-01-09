import assert from "node:assert";
import { DataType } from "@gatewai/db";
import {
	type CropNodeConfig,
	CropNodeConfigSchema,
	type FileData,
	type NodeResult,
	type Output,
	type OutputItem,
} from "@gatewai/types";
import { backendPixiService } from "../../media/pixi-processor.js";
import { ResolveFileDataUrl } from "../../utils/misc.js";
import { getInputValue } from "../resolvers.js";
import type { NodeProcessor } from "./types.js";

const cropProcessor: NodeProcessor = async ({ node, data }) => {
	try {
		const imageInput = getInputValue(data, node.id, true, {
			dataType: DataType.Image,
			label: "Image",
		})?.data as FileData | null;
		const cropConfig = CropNodeConfigSchema.parse(node?.config);
		const { leftPercentage, topPercentage, widthPercentage, heightPercentage } =
			cropConfig;

		assert(imageInput);
		const imageUrl = ResolveFileDataUrl(imageInput);
		assert(imageUrl);

		const { dataUrl, ...dimensions } = await backendPixiService.processCrop(
			imageUrl,
			{
				leftPercentage,
				topPercentage,
				widthPercentage,
				heightPercentage,
			},
		);

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
