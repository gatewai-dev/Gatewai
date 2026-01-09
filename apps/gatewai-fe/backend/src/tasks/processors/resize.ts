import assert from "node:assert";
import { DataType } from "@gatewai/db";
import {
	type FileData,
	type NodeResult,
	type Output,
	type OutputItem,
	ResizeNodeConfigSchema,
} from "@gatewai/types";
import parseDataUrl from "data-urls";
import { backendPixiService } from "../../media/pixi-processor.js";
import { logImage } from "../../media-logger.js";
import { ResolveFileDataUrl } from "../../utils/misc.js";
import { getInputValue } from "../resolvers.js";
import type { NodeProcessor } from "./types.js";

const resizeProcessor: NodeProcessor = async ({ node, data }) => {
	try {
		console.log("PROCESSING RESIZE");
		const imageInput = getInputValue(data, node.id, true, {
			dataType: DataType.Image,
			label: "Image",
		})?.data as FileData | null;
		const resizeConfig = ResizeNodeConfigSchema.parse(node.config);

		assert(imageInput);
		const imageUrl = ResolveFileDataUrl(imageInput);
		assert(imageUrl);

		const processResult = await backendPixiService.processResize(imageUrl, {
			width: resizeConfig.width,
			height: resizeConfig.height,
		});

		const parsed = parseDataUrl(processResult.dataUrl);
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
					data: { processData: processResult },
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
