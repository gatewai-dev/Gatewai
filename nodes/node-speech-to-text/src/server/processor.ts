import assert from "node:assert";
import { readFile, rm } from "node:fs/promises";
import { type EnvConfig, type IMediaRendererService, logger } from "@gatewai/core";
import { TOKENS } from "@gatewai/core/di";
import type { OutputItem, VirtualMediaData } from "@gatewai/core/types";
import { DataType } from "@gatewai/db";
import type {
    AIProvider,
    BackendNodeProcessorCtx,
    BackendNodeProcessorResult,
    GraphResolvers,
    NodeProcessor,
    StorageService,
} from "@gatewai/node-sdk/server";
import { createPartFromUri, createUserContent, type GoogleGenAI } from "@google/genai";
import { inject, injectable } from "inversify";
import { SpeechToTextNodeConfigSchema } from "../shared/config.js";
import type { SpeechToTextResult } from "../shared/index.js";

@injectable()
export class SpeechToTextProcessor implements NodeProcessor {
    constructor(
        @inject(TOKENS.STORAGE) private storage: StorageService,
        @inject(TOKENS.GRAPH_RESOLVERS) private graph: GraphResolvers,
        @inject(TOKENS.ENV) private env: EnvConfig,
        @inject(TOKENS.AI_PROVIDER) private aiProvider: AIProvider,
        @inject(TOKENS.MEDIA_RENDERER) private renderer: IMediaRendererService,
    ) { }

    async process({
        node,
        data,
    }: BackendNodeProcessorCtx): Promise<BackendNodeProcessorResult<SpeechToTextResult>> {
        let tempFilePathToCleanup: string | undefined;
        try {
            const userPrompt = this.graph.getInputValue(data, node.id, false, {
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

            if (audioInput?.operation) {
                const virtualMedia = audioInput as unknown as VirtualMediaData;
                const operation = virtualMedia.operation;

                if (operation.op === "source") {
                    // Optimization: If it's just a source, use it directly
                    const source = operation.source;
                    if (source.entity) {
                        const buffer = await this.storage.getFromStorage(
                            source.entity.key,
                        );
                        assert(source.entity.mimeType, "Mime type is missing");
                        fileBlob = new Blob([new Uint8Array(buffer)], {
                            type: source.entity.mimeType,
                        });
                        mimeType = source.entity.mimeType;
                    } else if (source.processData?.tempKey) {
                        const buffer = await this.storage.getFromStorage(
                            source.processData.tempKey,
                        );
                        assert(source.processData.mimeType, "Mime type is missing");
                        fileBlob = new Blob([new Uint8Array(buffer)], {
                            type: source.processData.mimeType,
                        });
                        mimeType = source.processData.mimeType;
                    } else {
                        return {
                            success: false,
                            error: "VirtualMedia source data could not be resolved",
                        };
                    }
                } else {
                    // It's a complex operation, render it
                    const renderResult = await this.renderer.renderComposition({
                        compositionId: "CompositionScene",
                        inputProps: {
                            virtualMedia,
                            viewportWidth: 1, // Not used for audio
                            viewportHeight: 1,
                            type: "Audio",
                        },
                        width: 1,
                        height: 1,
                        fps: virtualMedia.metadata.fps ?? 30,
                        durationInFrames: (virtualMedia.metadata.durationMs ?? 1000) / 1000 * (virtualMedia.metadata.fps ?? 30),
                        codec: "mp3",
                        envVariables: {
                            VITE_BASE_URL: this.env.BASE_URL,
                        },
                    });

                    tempFilePathToCleanup = renderResult.filePath;
                    const buffer = await readFile(renderResult.filePath);
                    fileBlob = new Blob([new Uint8Array(buffer)], { type: "audio/mp3" });
                    mimeType = "audio/mp3";
                }
            } else {
                return {
                    success: false,
                    error: "Input audio data could not be resolved, expected VirtualMediaData",
                };
            }
            const genAI = this.aiProvider.getGemini<GoogleGenAI>();

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
            const userContentItems = [
                createPartFromUri(audioFile.uri, audioFile.mimeType),
            ]
            if (userPrompt) {
                userContentItems.push({
                    text: userPrompt
                });
            }

            const response = await genAI.models.generateContent({
                model: nodeConfig.model,
                contents: createUserContent(userContentItems),
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
            const errMessage = err instanceof Error ? err.message : "TTS Failed";
            logger.error(errMessage);
            return {
                success: false,
                error: "AudioUnderstanding processing failed",
            };
        } finally {
            if (tempFilePathToCleanup) {
                await rm(tempFilePathToCleanup, { force: true }).catch(() => { });
            }
        }
    }
}