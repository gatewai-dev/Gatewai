import type { EnvConfig } from "@gatewai/core";
import { logger } from "@gatewai/core";
import { TOKENS } from "@gatewai/core/di";
import type { OutputItem, TextToSpeechResult } from "@gatewai/core/types";
import type { PrismaClient } from "@gatewai/db";
import { DataType } from "@gatewai/db";
import {
    defineNode,
} from "@gatewai/node-sdk/server";
import type {
    AIProvider,
    BackendNodeProcessorCtx,
    BackendNodeProcessorResult,
    GraphResolvers,
    NodeProcessor,
    StorageService,
} from "@gatewai/node-sdk/server";
import { type GoogleGenAI } from "@google/genai";
import { inject, injectable } from "tsyringe";
import metadata, { TextToSpeechNodeConfigSchema } from "../metadata.js";

@injectable()
class TextToSpeechProcessor implements NodeProcessor {
    constructor(
        @inject(TOKENS.PRISMA) private prisma: PrismaClient,
        @inject(TOKENS.GRAPH_RESOLVERS) private graph: GraphResolvers,
        @inject(TOKENS.STORAGE) private storage: StorageService,
        @inject(TOKENS.ENV) private env: EnvConfig,
        @inject(TOKENS.AI_PROVIDER) private aiProvider: AIProvider,
    ) { }

    async process({
        node,
        data,
    }: BackendNodeProcessorCtx): Promise<BackendNodeProcessorResult> {
        try {
            const genAI = this.aiProvider.getGemini<GoogleGenAI>();

            const textInput = this.graph.getInputValue(data, node.id, true, {
                dataType: DataType.Text,
                label: "Prompt",
            })?.data as string;

            if (!textInput) {
                return { success: false, error: "No text input provided" };
            }

            const nodeConfig = TextToSpeechNodeConfigSchema.parse(node.config);

            let speechConfig: any;
            if (nodeConfig.speakerConfig?.length) {
                speechConfig = {
                    multiSpeakerVoiceConfigs: nodeConfig.speakerConfig.map((s) => ({
                        speaker: s.speaker,
                        voiceConfig: {
                            prebuiltVoiceConfig: { voiceName: s.voiceName },
                        },
                    })),
                };
            } else {
                speechConfig = {
                    voiceConfig: {
                        prebuiltVoiceConfig: {
                            voiceName: nodeConfig.voiceName ?? "Kore",
                        },
                    },
                };
            }

            const response = await genAI.models.generateContent({
                model: nodeConfig.model ?? "gemini-2.5-flash-preview-tts",
                contents: [{ role: "user", parts: [{ text: textInput }] }],
                config: {
                    responseModalities: ["AUDIO"],
                    speechConfig,
                },
            });

            const audioData =
                response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
            if (!audioData) {
                return { success: false, error: "No audio generated" };
            }

            const audioBuffer = Buffer.from(audioData, "base64");
            const mimeType = "audio/wav";
            const key = `${(data.task ?? node).id}/${Date.now()}.wav`;

            const { signedUrl, key: tempKey } =
                await this.storage.uploadToTemporaryStorageFolder(
                    audioBuffer,
                    mimeType,
                    key,
                );

            const outputHandle = data.handles.find(
                (h) => h.nodeId === node.id && h.type === "Output",
            );
            if (!outputHandle)
                return { success: false, error: "Output handle is missing." };

            const newResult = structuredClone(
                node.result as unknown as TextToSpeechResult,
            ) ?? {
                outputs: [],
                selectedOutputIndex: 0,
            };

            newResult.outputs.push({
                items: [
                    {
                        type: DataType.Audio,
                        data: {
                            processData: {
                                dataUrl: signedUrl,
                                tempKey,
                                mimeType,
                            },
                        },
                        outputHandleId: outputHandle.id,
                    },
                ] as [OutputItem<"Audio">],
            });
            newResult.selectedOutputIndex = newResult.outputs.length - 1;

            return { success: true, newResult };
        } catch (err: unknown) {
            logger.error(
                err instanceof Error ? err.message : "TTS processing failed",
            );
            return {
                success: false,
                error: "Text-to-speech processing failed",
            };
        }
    }
}

export const textToSpeechNode = defineNode(metadata, {
    backendProcessor: TextToSpeechProcessor,
});

export default textToSpeechNode;
