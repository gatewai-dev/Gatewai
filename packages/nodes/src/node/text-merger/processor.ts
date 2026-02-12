import { TOKENS } from "@gatewai/core/di";
import type { TextMergerResult } from "@gatewai/core/types";
import { DataType } from "@gatewai/db";
import type {
	BackendNodeProcessorCtx,
	BackendNodeProcessorResult,GraphResolvers, 
	NodeProcessor
} from "@gatewai/node-sdk";
import { inject, injectable } from "tsyringe";
import { TextMergerNodeConfigSchema } from "../../node-configs.schema.js";

@injectable()
export default class TextMergerProcessor implements NodeProcessor {
	constructor(
		@inject(TOKENS.GRAPH_RESOLVERS) private graph: GraphResolvers,
	) { }

	async process({
		node,
		data,
	}: BackendNodeProcessorCtx): Promise<BackendNodeProcessorResult> {
		try {
			const textInputs = this.graph.getInputValuesByType(data, node.id, {
				dataType: DataType.Text,
			});

			const nodeConfig = TextMergerNodeConfigSchema.parse(node.config);
			const joinString = nodeConfig?.join ?? "\n";

			const texts = textInputs
				.filter(
					(v): v is NonNullable<typeof v> => v !== null && v !== undefined,
				)
				.map((v) => String(v.data));
			const merged = texts.join(joinString);

			const outputHandle = data.handles.find(
				(h) => h.nodeId === node.id && h.type === "Output",
			);
			if (!outputHandle)
				return { success: false, error: "Output handle is missing." };

			const newResult: TextMergerResult = {
				selectedOutputIndex: 0,
				outputs: [
					{
						items: [
							{
								type: DataType.Text,
								data: merged,
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
			return { success: false, error: "Text merger processing failed" };
		}
	}
}
