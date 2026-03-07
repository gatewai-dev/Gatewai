import assert from "node:assert";
import { type EnvConfig, logger } from "@gatewai/core";
import { container, TOKENS } from "@gatewai/core/di";
import type { VirtualMediaData } from "@gatewai/core/types";
import type { PrismaClient } from "@gatewai/db";
import type {
    BackendNodeProcessorCtx,
    BackendNodeProcessorResult,
    GraphResolvers,
    NodeProcessor,
    StorageService
} from "@gatewai/node-sdk/server";
import { inject, injectable } from "inversify";
import type { ExportResult } from "../shared/index.js";

@injectable()
export class ExportServerProcessor implements NodeProcessor {
    constructor(
        @inject(TOKENS.GRAPH_RESOLVERS) private graph: GraphResolvers,
        @inject(TOKENS.PRISMA) private prisma: PrismaClient,
        @inject(TOKENS.ENV) private env: EnvConfig,
        @inject(TOKENS.STORAGE) private storage: StorageService,
    ) { }

    async process({
        node,
        data,
    }: BackendNodeProcessorCtx): Promise<BackendNodeProcessorResult<ExportResult>> {
        try {
            const inputValue = this.graph.getInputValue(data, node.id, false, {});
            assert(inputValue);
            const newResult = structuredClone(
                node.result as unknown as ExportResult,
            ) ?? {
                outputs: [],
                selectedOutputIndex: 0,
            };

            const dataToPass = inputValue.data;

            const newGeneration: ExportResult["outputs"][number] = {
                items: [
                    {
                        type: inputValue.type,
                        data: dataToPass,
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
