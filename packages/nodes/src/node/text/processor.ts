import { DataType } from "@gatewai/db";
import type {
	BackendNodeProcessorCtx,
	BackendNodeProcessorResult,
	NodeProcessor,
} from "@gatewai/node-sdk";
import type { TextNodeConfig, TextResult } from "@gatewai/types";
import { injectable } from "tsyringe";

@injectable()
export default class TextProcessor implements NodeProcessor {
	async process({
		node,
		data,
	}: BackendNodeProcessorCtx): Promise<BackendNodeProcessorResult> {
		try {
			const nodeConfig = node.config as TextNodeConfig;
			const outputHandle = data.handles.find(
				(h) => h.nodeId === node.id && h.type === "Output",
			);
			if (!outputHandle)
				return { success: false, error: "Output handle is missing." };

			const newResult: TextResult = {
				selectedOutputIndex: 0,
				outputs: [
					{
						items: [
							{
								type: DataType.Text,
								data: nodeConfig.content ?? "",
								outputHandleId: outputHandle.id,
							},
						],
					},
				],
			};

			return { success: true, newResult };
		} catch (err: unknown) {
			if (err instanceof Error) {
				return { success: false, error: err.message };
			}
			return { success: false, error: "Text processing failed" };
		}
	}
}
