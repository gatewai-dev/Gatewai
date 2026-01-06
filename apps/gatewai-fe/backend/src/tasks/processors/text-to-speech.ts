import { randomUUID } from "node:crypto";
import { DataType, prisma } from "@gatewai/db";
import {
	type TextToSpeechNodeConfig,
	TextToSpeechNodeConfigSchema,
	type TextToSpeechResult,
} from "@gatewai/types";
import type { SpeechConfig } from "@google/genai";
import * as mm from "music-metadata";
import wav from "wav";
import { ENV_CONFIG } from "../../config.js";
import { genAI } from "../../genai.js";
import { logger } from "../../logger.js";
import { generateSignedUrl, uploadToS3 } from "../../utils/storage.js";
import { getInputValue } from "../resolvers.js";
import type { NodeProcessor } from "./types.js";

// Helper to convert the Gemini PCM stream into a WAV Buffer
async function encodeWavBuffer(pcmBuffer: Buffer): Promise<Buffer> {
	return new Promise((resolve, reject) => {
		const writer = new wav.Writer({
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

const textToSpeechProcessor: NodeProcessor = async ({ node, data }) => {
	try {
		const userPrompt = getInputValue(data, node.id, true, {
			dataType: DataType.Text,
			label: "Prompt",
		})?.data as string;

		let nodeConfig: TextToSpeechNodeConfig;
		try {
			nodeConfig = TextToSpeechNodeConfigSchema.parse(node.config);
		} catch (error) {
			logger.error(error);
			return { success: false, error: "Invalid config." };
		}

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

		const response = await genAI.models.generateContent({
			model: nodeConfig.model || "gemini-2.5-flash-tts", // Ensure compatible model
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

		// 1. Convert base64 to raw PCM buffer
		const pcmBuffer = Buffer.from(rawPcmData, "base64");

		// 2. Wrap PCM in a WAV container so players/metadata-readers can read it
		const wavBuffer = await encodeWavBuffer(pcmBuffer);

		// 3. Extract metadata from the now-valid WAV buffer
		const metadata = await mm.parseBuffer(wavBuffer, "audio/wav");
		const duration = metadata.format.duration ?? 0;

		const extension = ".wav";

		const randId = randomUUID();
		const fileName = `text_to_speech_${randId}${extension}`;
		const key = `assets/${fileName}`;
		const contentType = "audio/wav"; // Changed from video/wav
		const bucket = ENV_CONFIG.GCS_ASSETS_BUCKET;

		await uploadToS3(wavBuffer, key, contentType, bucket);

		// ... [Database and Signed URL logic remains the same] ...
		const expiresIn = 3600 * 24 * 6.9;
		const signedUrl = await generateSignedUrl(key, bucket, expiresIn);
		const signedUrlExp = new Date(Date.now() + expiresIn * 1000);

		const asset = await prisma.fileAsset.create({
			data: {
				name: fileName,
				bucket,
				key,
				signedUrl,
				signedUrlExp,
				mimeType: contentType,
				duration,
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
};

export default textToSpeechProcessor;
