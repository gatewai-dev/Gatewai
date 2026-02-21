import { DataType } from "@gatewai/db";
import type {
	BackendNodeProcessorCtx,
	BackendNodeProcessorResult,
	NodeProcessor,
} from "@gatewai/node-sdk/server";
import { injectable } from "inversify";
import { TextNodeConfigSchema } from "../metadata.js";
import type { TextResult } from "../shared/index.js";

@injectable()
export class TextProcessor implements NodeProcessor {
	async process({
		node,
		data,
	}: BackendNodeProcessorCtx): Promise<BackendNodeProcessorResult<TextResult>> {
		const text = TextNodeConfigSchema.parse(node.config).content ?? "";

		const outputHandle = data.handles.find(
			(h) => h.nodeId === node.id && h.type === "Output",
		);

		return {
			success: true,
			newResult: {
				outputs: [
					{
						items: [
							{
								type: DataType.Text,
								data: text,
								outputHandleId: outputHandle?.id,
							},
						],
					},
				],
				selectedOutputIndex: 0,
			},
		};
	}
}
