import { generateId, logger } from "@gatewai/core";
import {
	type OutputItem,
	type TextToSpeechResult,
} from "@gatewai/core/types";
import { DataType } from "@gatewai/db";
import type {
	BackendNodeProcessorCtx,
	BackendNodeProcessorResult,
	NodeProcessor,
} from "@gatewai/node-sdk";
import { TextToSpeechNodeConfigSchema } from "../../configs/text-to-speech.config.js";
import { parseBuffer } from "music-metadata";
import { TOKENS } from "@gatewai/core/di";
import type { PrismaClient } from "@gatewai/db";
import type { EnvConfig } from "@gatewai/core";
import { inject, injectable } from "tsyringe";
import type {
	GraphResolvers,
	StorageService,
} from "@gatewai/node-sdk";
import * as wav from "wav";
import { getGenAIClient } from "../genai.js";

async function encodeWavBuffer(pcmBuffer: Buffer): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		const writer = new wav.default.Writer({
			channels: 1,
			sampleRate: 24000,
			bitDepth: 16,
		});

		const chunks: Buffer[] = [];
		writer.on("data", (chunk: Buffer<ArrayBufferLike>) => chunks.push(chunk));
		writer.on("end", () => resolve(Buffer.concat(chunks)));
		writer.on("error", reject);

		writer.write(pcmBuffer);
		writer.end();
	});
}

@injectable()
export default class TextToSpeechProcessor implements NodeProcessor {
	constructor(
		@inject(TOKENS.PRISMA) private prisma: PrismaClient,
		@inject(TOKENS.GRAPH_RESOLVERS) private graph: GraphResolvers,
		@inject(TOKENS.STORAGE) private storage: StorageService,
		@inject(TOKENS.ENV) private env: EnvConfig,
	) { }

	async process({
		node,
		data,
	}: BackendNodeProcessorCtx): Promise<BackendNodeProcessorResult> {
		const genAI = getGenAIClient(this.env.GEMINI_API_KEY);
		try {
			const userPrompt = this.graph.getInputValue(data, node.id, true, {
				dataType: DataType.Text,
				label: "Prompt",
			})?.data as string;

			const nodeConfig = TextToSpeechNodeConfigSchema.parse(node.config);

			let speechConfig: Record<string, unknown> = {
				languageCode: nodeConfig.languageCode as string,
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

			const response = await genAI.models.generateContent({
				model: nodeConfig.model ?? "gemini-2.5-flash-preview-tts",
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

			const metadata = await parseBuffer(wavBuffer, "audio/wav");
			const durationInSec = metadata.format.duration ?? 0;

			const extension = "wav";
			const randId = generateId();
			const fileName = `${node.name}_${randId}.${extension}`;
			const key = `assets/${fileName}`;
			const contentType = "audio/wav";
			const bucket = this.env.GCS_ASSETS_BUCKET;

			await this.storage.uploadToGCS(wavBuffer, key, contentType, bucket);

			const expiresIn = 3600 * 24 * 6.9;
			const signedUrl = await this.storage.generateSignedUrl(key, bucket, expiresIn);
			const signedUrlExp = new Date(Date.now() + expiresIn * 1000);

			const asset = await this.prisma.fileAsset.create({
				data: {
					name: fileName,
					userId: data.canvas.userId,
					bucket,
					key,
					size: wavBuffer.length,
					signedUrl,
					signedUrlExp,
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

			const newResultOutput = {
				items: [
					{
						type: DataType.Audio,
						data: { entity: asset },
						outputHandleId: outputHandle.id,
					},
				] as [OutputItem<"Audio">],
			};

			newResult.outputs.push(newResultOutput);
			newResult.selectedOutputIndex = newResult.outputs.length - 1;

			return { success: true, newResult };
		} catch (err: unknown) {
			logger.error(err instanceof Error ? err.message : "TTS Failed");
			return { success: false, error: "TextToSpeech processing failed" };
		}
	}
}
