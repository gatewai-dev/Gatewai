import type { EnvConfig } from "@gatewai/core";
import { logger } from "@gatewai/core";
import { TOKENS } from "@gatewai/core/di";
import type { FileData, LLMNodeResult } from "@gatewai/core/types";
import { DataType } from "@gatewai/db";
import type {
    AIProvider,
    BackendNodeProcessorCtx,
    BackendNodeProcessorResult,
    GraphResolvers,
    NodeProcessor,
} from "@gatewai/node-sdk";
import { defineNode } from "@gatewai/node-sdk";
import {
    createPartFromUri,
    createUserContent,
} from "@google/genai";
import { inject, injectable } from "tsyringe";
import metadata, { LLMNodeConfigSchema } from "../metadata.js";

@injectable()
class LLMProcessor implements NodeProcessor {
    constructor(
        @inject(TOKENS.GRAPH_RESOLVERS) private graph: GraphResolvers,
        @inject(TOKENS.ENV) private env: EnvConfig,
        @inject(TOKENS.AI_PROVIDER) private aiProvider: AIProvider,
    ) { }

    async process({
        node,
        data,
    }: BackendNodeProcessorCtx): Promise<BackendNodeProcessorResult> {
        try {
            const genAI = this.aiProvider.getClient(this.env.GEMINI_API_KEY);

            const userPrompt = this.graph.getInputValue(data, node.id, true, {
                dataType: DataType.Text,
                label: "Prompt",
            })?.data as string;

            const systemPrompt = this.graph.getInputValue(data, node.id, false, {
                dataType: DataType.Text,
                label: "System Prompt",
            })?.data as string | undefined;

            const imageInputs = this.graph
                .getInputValuesByType(data, node.id, {
                    dataType: DataType.Image,
                })
                .map((m) => m?.data) as FileData[] | null;

            const nodeConfig = LLMNodeConfigSchema.parse(node.config);

            const parts: any[] = [];

            if (imageInputs?.length) {
                for (const imageInput of imageInputs) {
                    if (!imageInput) continue;
                    const arrayBuffer = await this.graph.loadMediaBuffer(imageInput);
                    const buffer = Buffer.from(arrayBuffer);
                    const base64Data = buffer.toString("base64");
                    const mimeType = await this.graph.getFileDataMimeType(imageInput);
                    if (mimeType) {
                        parts.push({
                            inlineData: { data: base64Data, mimeType },
                        });
                    }
                }
            }

            parts.push(userPrompt);

            const response = await genAI.models.generateContent({
                model: nodeConfig.model,
                contents: createUserContent(parts),
                config: {
                    systemInstruction: systemPrompt,
                    temperature: nodeConfig.temperature,
                },
            });

            if (!response.text)
                return { success: false, error: "LLM response is empty" };

            const outputHandle = data.handles.find(
                (h) => h.nodeId === node.id && h.type === "Output",
            );
            if (!outputHandle)
                return { success: false, error: "Output handle is missing." };

            const newResult = structuredClone(
                node.result as unknown as LLMNodeResult,
            ) ?? {
                outputs: [],
                selectedOutputIndex: 0,
            };

            newResult.outputs.push({
                items: [
                    {
                        type: DataType.Text,
                        data: response.text,
                        outputHandleId: outputHandle.id,
                    },
                ],
            });
            newResult.selectedOutputIndex = newResult.outputs.length - 1;

            return { success: true, newResult };
        } catch (err: unknown) {
            logger.error(err instanceof Error ? err.message : "LLM Failed");
            return { success: false, error: "LLM processing failed" };
        }
    }
}

export default defineNode(metadata, { backendProcessor: LLMProcessor });
