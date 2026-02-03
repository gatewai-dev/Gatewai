import { DataType } from "@gatewai/db";
import {
	TextMergerNodeConfigSchema,
	type TextMergerResult,
} from "@gatewai/types";
import { getInputValuesByType } from "../resolvers.js";
import type { NodeProcessor } from "./types.js";

const textMergerProcessor: NodeProcessor = async ({ node, data }) => {
	try {
		const textInputs = getInputValuesByType(data, node.id, {
			dataType: DataType.Text,
		}).map((m) => m?.data) as string[] | null;

		// 3. Generate Content
		const nodeConfig = TextMergerNodeConfigSchema.parse(node.config);

		const joinStr = nodeConfig.join;

		const resultStr = textInputs?.join(joinStr);

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

		const newGeneration: TextMergerResult["outputs"][number] = {
			items: [
				{
					type: DataType.Text,
					data: resultStr ?? "",
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

export default textMergerProcessor;
