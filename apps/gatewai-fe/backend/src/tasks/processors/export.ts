import { DataType } from "@gatewai/db";
import type { ExportResult } from "@gatewai/types";
import { getInputValue, getInputValuesByType } from "../resolvers.js";
import type { NodeProcessor } from "./types.js";

const exportProcessor: NodeProcessor = async ({ node, data }) => {
	try {
		const inputValue = getInputValue(data, node.id, true, {});

		const newResult = structuredClone(
			node.result as unknown as ExportResult,
		) ?? {
			outputs: [],
			selectedOutputIndex: 0,
		};

		const newGeneration: ExportResult["outputs"][number] = {
			items: [
				{
					type: inputValue?.type,
					data: inputValue,
					outputHandleId: null,
				},
			],
		};

		newResult.outputs.push(newGeneration);
		newResult.selectedOutputIndex = 0;

		return { success: true, newResult };
	} catch (err: unknown) {
		if (err instanceof Error) {
			return { success: false, error: err.message };
		}
		return { success: false, error: "Text Merger processing failed" };
	}
};

export default exportProcessor;
