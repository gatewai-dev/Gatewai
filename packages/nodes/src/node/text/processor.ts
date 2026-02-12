import type { TextResult } from "@gatewai/core/types";
import { DataType } from "@gatewai/db";
import type {
	BackendNodeProcessorCtx,
	BackendNodeProcessorResult,
	NodeProcessor,
} from "@gatewai/node-sdk";
import { injectable } from "tsyringe";
import { TextNodeConfigSchema } from "../../node-configs.schema.js";

@injectable()
export default class TextProcessor implements NodeProcessor {
	constructor() {}

	async process({
		node,
		data,
	}: BackendNodeProcessorCtx): Promise<BackendNodeProcessorResult> {
		try {
			const nodeConfig = TextNodeConfigSchema.parse(node.config);
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
