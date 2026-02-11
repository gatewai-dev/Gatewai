import assert from "node:assert";
import type {
	BackendNodeProcessorCtx,
	BackendNodeProcessorResult,
	NodeProcessor,
} from "@gatewai/node-sdk";
import type { ExportResult } from "@gatewai/types";
import { injectable } from "tsyringe";

@injectable()
export default class ExportProcessor implements NodeProcessor {
	async process({
		node,
		data,
		graph,
	}: BackendNodeProcessorCtx): Promise<BackendNodeProcessorResult> {
		try {
			const inputValue = graph.getInputValue(data, node.id, true, {});
			assert(inputValue);

			const newResult = structuredClone(
				node.result as unknown as ExportResult,
			) ?? {
				outputs: [],
				selectedOutputIndex: 0,
			};

			const newGeneration: ExportResult["outputs"][number] = {
				items: [
					{
						type: inputValue.type,
						data: inputValue.data,
						outputHandleId: undefined,
					} as unknown as ExportResult["outputs"][number]["items"][number],
				],
			};

			newResult.outputs.push(newGeneration);
			newResult.selectedOutputIndex = 0;

			return { success: true, newResult };
		} catch (err: unknown) {
			if (err instanceof Error) {
				return { success: false, error: err.message };
			}
			return { success: false, error: "Export processing failed" };
		}
	}
}
