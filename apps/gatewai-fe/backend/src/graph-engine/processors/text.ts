import { DataType } from "@gatewai/db";
import {
	type TextMergerResult,
	TextNodeConfigSchema,
	type TextResult,
} from "@gatewai/types";
import type { NodeProcessor } from "./types.js";

const textProcessor: NodeProcessor = async ({ node, data }) => {
	try {
		// 3. Generate Content
		const nodeConfig = TextNodeConfigSchema.parse(node.config);

		const outputHandle = data.handles.find(
			(h) => h.nodeId === node.id && h.type === "Output",
		);
		if (!outputHandle)
			return { success: false, error: "Output handle is missing." };

		const newResult = structuredClone(
			node.result as unknown as TextMergerResult,
		) ?? {
			outputs: [],
			selectedOutputIndex: 0,
		};

		const newGeneration: TextResult["outputs"][number] = {
			items: [
				{
					type: DataType.Text,
					data: nodeConfig.content ?? "",
					outputHandleId: outputHandle.id,
				},
			],
		};

		newResult.outputs = [newGeneration];
		newResult.selectedOutputIndex = 0;

		return { success: true, newResult };
	} catch (err: unknown) {
		if (err instanceof Error) {
			return { success: false, error: err.message };
		}
		return { success: false, error: "Text Merger processing failed" };
	}
};

export default textProcessor;
