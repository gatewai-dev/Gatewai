import { spawn } from "node:child_process";
import type { EnvConfig } from "@gatewai/core";
import { generateId, logger } from "@gatewai/core";
import { TOKENS } from "@gatewai/core/di";
import type { TextToSpeechResult } from "../shared/index.js";

;

import type { PrismaClient } from "@gatewai/db";
import { DataType } from "@gatewai/db";
import type {
    AIProvider,
    BackendNodeProcessorCtx,
    BackendNodeProcessorResult,
    GraphResolvers,
    NodeProcessor,
    StorageService,
} from "@gatewai/node-sdk/server";
import type { GoogleGenAI, SpeechConfig } from "@google/genai";
import * as mm from "music-metadata";
import { inject, injectable } from "tsyringe";
import { TextToSpeechNodeConfigSchema } from "../shared/config.js";

async function encodeWavBuffer(pcmBuffer: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
        const ffmpeg = spawn("ffmpeg", [
            "-f", "s16le",
            "-ar", "24000",
            "-ac", "1",
            "-i", "pipe:0",
            "-f", "wav",
            "pipe:1"
        ]);

        const chunks: Buffer[] = [];
        ffmpeg.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));

        let stderrOutput = "";
        ffmpeg.stderr.on("data", (data: Buffer) => {
            stderrOutput += data.toString();
        });

        ffmpeg.on("close", (code) => {
            if (code === 0) {
                resolve(Buffer.concat(chunks));
            } else {
                reject(new Error(`ffmpeg exited with code ${code}: ${stderrOutput}`));
            }
        });

        ffmpeg.on("error", reject);

        ffmpeg.stdin.write(pcmBuffer);
        ffmpeg.stdin.end();
    });
}

@injectable()
export class TextToSpeechProcessor implements NodeProcessor {
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
    }: BackendNodeProcessorCtx): Promise<BackendNodeProcessorResult<TextToSpeechResult>> {
        try {
            const userPrompt = this.graph.getInputValue(data, node.id, true, {
                dataType: DataType.Text,
                label: "Prompt",
            })?.data as string;

            const nodeConfig = TextToSpeechNodeConfigSchema.parse(node.config);

            let speechConfig: SpeechConfig = {
                languageCode: nodeConfig.languageCode,
            };

            if (
                nodeConfig.speakerConfig?.length &&
                nodeConfig.speakerConfig?.length > 1
            ) {
                speechConfig.multiSpeakerVoiceConfig = {
                    speakerVoiceConfigs: nodeConfig.speakerConfig?.map((v) => ({
                        speaker: v.speaker,
                        voiceConfig: {
                            prebuiltVoiceConfig: { voiceName: v.voiceName },
                        },
                    })),
                };
            } else {
                speechConfig = {
                    ...speechConfig,
                    voiceConfig: {
                        prebuiltVoiceConfig: { voiceName: nodeConfig.voiceName },
                    },
                };
            }

            const response = await this.aiProvider.getGemini<GoogleGenAI>().models.generateContent({
                model: nodeConfig.model ?? "gemini-2.5-flash-preview-tts", // Ensure compatible model
                contents: [{ parts: [{ text: userPrompt }] }],
                config: {
                    responseModalities: ["AUDIO"],
                    speechConfig,
                },
            });

            const rawPcmData =
                response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
            if (!rawPcmData) {
                return { success: false, error: "No audio data returned from Gemini." };
            }

            const pcmBuffer = Buffer.from(rawPcmData, "base64");

            const wavBuffer = await encodeWavBuffer(pcmBuffer);

            const metadata = await mm.parseBuffer(wavBuffer, "audio/wav");
            const durationInSec = metadata.format.duration ?? 0;

            const extension = "wav";

            const randId = generateId();
            const fileName = `${node.name}_${randId}.${extension}`;
            const key = `assets/${fileName}`;
            const contentType = "audio/wav";
            const bucket = this.env.GCS_ASSETS_BUCKET;

            await this.storage.uploadToStorage(wavBuffer, key, contentType, bucket);

            const asset = await this.prisma.fileAsset.create({
                data: {
                    name: fileName,
                    userId: data.canvas.userId,
                    bucket,
                    key,
                    size: wavBuffer.length,
                    mimeType: contentType,
                    duration: durationInSec * 1000,
                    metadata: metadata as object,
                },
            });

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
                        data: { entity: asset },
                        outputHandleId: outputHandle.id,
                    },
                ],
            });
            newResult.selectedOutputIndex = newResult.outputs.length - 1;

            return { success: true, newResult };
        } catch (err: unknown) {
            logger.error(err instanceof Error ? err.message : "TTS Failed");
            return { success: false, error: "TextToSpeech processing failed" };
        }
    }
}