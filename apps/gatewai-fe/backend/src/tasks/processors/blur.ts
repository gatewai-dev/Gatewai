import assert from "node:assert";
import { DataType } from "@gatewai/db";
import {
	BlurNodeConfigSchema,
	type BlurResult,
	type FileData,
	type NodeResult,
} from "@gatewai/types";
import parseDataUrl from "data-urls";
import { backendPixiService } from "../../media/pixi-processor.js";
import { logImage } from "../../media-logger.js";
import { ResolveFileDataUrl } from "../../utils/misc.js";
import { getInputValue } from "../resolvers.js";
import type { NodeProcessor } from "./types.js";

const blurProcessor: NodeProcessor = async ({ node, data }) => {
	try {
		const imageInput = getInputValue(data, node.id, true, {
			dataType: DataType.Image,
			label: "Image",
		})?.data as FileData | null;

		assert(imageInput);
		const imageUrl = ResolveFileDataUrl(imageInput);

		if (!imageUrl) {
			return { success: false, error: "No URL" };
		}

		const blurConfig = BlurNodeConfigSchema.parse(node.config);
		const blurSize = blurConfig.size ?? 0;

		if (!imageInput) {
			return { success: false, error: "No image input provided" };
		}

		const { dataUrl, ...dimensions } = await backendPixiService.processBlur(
			imageUrl,
			{
				blurSize,
			},
		);

		// const parsed = parseDataUrl(dataUrl);
		// if (parsed?.body.buffer) {
		// 	logImage(Buffer.from(parsed?.body.buffer), ".png", node.id);
		// }
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
		console.log(err);
		return {
			success: false,
			error: err instanceof Error ? err.message : "Blur processing failed",
		};
	}
};

export default blurProcessor;
