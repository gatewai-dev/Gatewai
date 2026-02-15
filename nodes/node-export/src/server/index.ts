import assert from "node:assert";
import { TOKENS } from "@gatewai/core/di";
import type { ExportResult } from "@gatewai/core/types";
import type {
    BackendNodeProcessorCtx,
    BackendNodeProcessorResult,
    GraphResolvers,
    NodeProcessor,
} from "@gatewai/node-sdk";
import { defineNode } from "@gatewai/node-sdk";
import { inject, injectable } from "tsyringe";
import metadata from "../metadata.js";

@injectable()
class ExportProcessor implements NodeProcessor {
    constructor(
        @inject(TOKENS.GRAPH_RESOLVERS) private graph: GraphResolvers,
    ) { }

    async process({
        node,
        data,
    }: BackendNodeProcessorCtx): Promise<BackendNodeProcessorResult> {
        try {
            const inputValue = this.graph.getInputValue(data, node.id, true, {});
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

export const exportNode = defineNode(metadata, { backendProcessor: ExportProcessor });

export default exportNode;
