import type { EnvConfig } from "@gatewai/core";
import { logger } from "@gatewai/core";
import { TOKENS } from "@gatewai/core/di";
import type { OutputItem, SpeechToTextResult } from "@gatewai/core/types";
import { DataType } from "@gatewai/db";
import type {
    AIProvider,
    BackendNodeProcessorCtx,
    BackendNodeProcessorResult,
    defineNode,
    GraphResolvers,
    NodeProcessor,
    StorageService,
} from "@gatewai/node-sdk/server";
import { createPartFromUri, createUserContent } from "@google/genai";
import { inject, injectable } from "tsyringe";
import metadata, { SpeechToTextNodeConfigSchema } from "../metadata.js";

@injectable()
class SpeechToTextProcessor implements NodeProcessor {
    constructor(
        @inject(TOKENS.STORAGE) private storage: StorageService,
        @inject(TOKENS.GRAPH_RESOLVERS) private graph: GraphResolvers,
        @inject(TOKENS.ENV) private env: EnvConfig,
        @inject(TOKENS.AI_PROVIDER) private aiProvider: AIProvider,
    ) { }

    async process({
        node,
        data,
    }: BackendNodeProcessorCtx): Promise<BackendNodeProcessorResult> {
        try {
            const userPrompt = this.graph.getInputValue(data, node.id, true, {
                dataType: DataType.Text,
                label: "Prompt",
            })?.data as string;

            const audioInput = this.graph.getInputValue(data, node.id, true, {
                dataType: DataType.Audio,
                label: "Audio",
            })?.data as OutputItem<"Audio">["data"];

            const nodeConfig = SpeechToTextNodeConfigSchema.parse(node.config);

            let fileBlob: Blob;
            let mimeType: string;
            if (audioInput?.entity?.signedUrl) {
                const buffer = await this.storage.getFromStorage(
                    audioInput.entity.key,
                    audioInput.entity.bucket,
                );
                fileBlob = new Blob([new Uint8Array(buffer)], {
                    type: audioInput.entity.mimeType,
                });
                mimeType = audioInput.entity.mimeType;
            } else if (audioInput?.processData?.tempKey) {
                const buffer = await this.storage.getFromStorage(
                    audioInput?.processData.tempKey,
                );
                fileBlob = new Blob([new Uint8Array(buffer)], {
                    type: audioInput?.processData.mimeType,
                });
                mimeType = audioInput?.processData.mimeType ?? "audio/wav";
            } else {
                return {
                    success: false,
                    error: "Input audio data could not be resolved",
                };
            }
            const genAI = this.aiProvider.getClient(this.env.GEMINI_API_KEY);

            const audioFile = await genAI.files.upload({
                file: fileBlob,
                config: { mimeType },
            });

            if (!audioFile.uri || !audioFile.mimeType) {
                return {
                    success: false,
                    error: "Uploaded audio data is corrupted.",
                };
            }

            const response = await genAI.models.generateContent({
                model: nodeConfig.model ?? "gemini-2.5-flash",
                contents: createUserContent([
                    createPartFromUri(audioFile.uri, audioFile.mimeType),
                    userPrompt,
                ]),
            });

            if (!response.text)
                return { success: false, error: "Response is empty." };

            const outputHandle = data.handles.find(
                (h) => h.nodeId === node.id && h.type === "Output",
            );
            if (!outputHandle)
                return { success: false, error: "Output handle is missing." };

            const newResult = structuredClone(
                node.result as unknown as SpeechToTextResult,
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
                ] as [OutputItem<"Text">],
            });
            newResult.selectedOutputIndex = newResult.outputs.length - 1;

            return { success: true, newResult };
        } catch (err: unknown) {
            logger.error(err instanceof Error ? err.message : "TTS Failed");
            return {
                success: false,
                error: "AudioUnderstanding processing failed",
            };
        }
    }
}

export const speechToTextNode = defineNode(metadata, {
    backendProcessor: SpeechToTextProcessor,
});

export default speechToTextNode;
