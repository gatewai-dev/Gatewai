import { DataType } from "@gatewai/db";
import {
	type BackendNodeProcessorCtx,
	type BackendNodeProcessorResult,
	defineNode,
	type NodeProcessor,
} from "@gatewai/node-sdk/server";
import { metadata } from "../metadata.js";

class TextProcessor implements NodeProcessor {
	async process({
		node,
		data,
	}: BackendNodeProcessorCtx): Promise<BackendNodeProcessorResult> {
		const text = (node.config as any).text ?? "";

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

export const textNode = defineNode(metadata, {
	backendProcessor: TextProcessor,
});

export default textNode;
