import { TOKENS } from "@gatewai/core/di";
import type { TextMergerResult } from "../shared/index.js";

;

import { DataType } from "@gatewai/db";
import type {
    BackendNodeProcessorCtx,
    BackendNodeProcessorResult,
    GraphResolvers,
    NodeProcessor,
} from "@gatewai/node-sdk/server";
import { inject, injectable } from "tsyringe";
import { TextMergerNodeConfigSchema } from "../shared/config.js";
import { joinText } from "../shared/join-fn.js";

@injectable()
export class TextMergerServerProcessor implements NodeProcessor {
    constructor(
        @inject(TOKENS.GRAPH_RESOLVERS) private graph: GraphResolvers,
    ) { }

    async process({
        node,
        data,
    }: BackendNodeProcessorCtx): Promise<BackendNodeProcessorResult<TextMergerResult>> {
        try {
            const textInputs = this.graph.getInputValuesByType(data, node.id, {
                dataType: DataType.Text,
            });

            const nodeConfig = TextMergerNodeConfigSchema.parse(node.config);
            const joinString = nodeConfig?.join ?? "\n";

            const texts = textInputs.map((v) => v?.data);
            const merged = joinText(texts, joinString);

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
