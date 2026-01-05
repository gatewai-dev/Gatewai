import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DataType, prisma } from "@gatewai/db";
import {
	type TextToSpeechNodeConfig,
	TextToSpeechNodeConfigSchema,
	type TextToSpeechResult,
} from "@gatewai/types";
import type { SpeechConfig } from "@google/genai";
import * as mm from "music-metadata";
import { ENV_CONFIG } from "../../config.js";
import { genAI } from "../../genai.js";
import { logger } from "../../logger.js";
import { generateSignedUrl, uploadToS3 } from "../../utils/storage.js";
import { getInputValue } from "../resolvers.js";
import type { NodeProcessor } from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
			return { success: false, error: "Anvalid config." };
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
			model: nodeConfig.model,
			contents: [{ parts: [{ text: userPrompt }] }],
			config: {
				responseModalities: ["AUDIO"],
				speechConfig,
			},
		});

		const responseData =
			response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
		if (!responseData) {
			return { success: false, error: "No data in response TTS result." };
		}
		const audioBuffer = Buffer.from(responseData, "base64");

		const metadata = await mm.parseBuffer(audioBuffer, "audio/wav");
		const duration = metadata.format.duration ?? 0;

		const extension = ".wav";

		const randId = randomUUID();
		const fileName = `text_to_speech_${randId}.${extension}`;
		const key = `assets/${data.canvas.userId}/${fileName}`;
		const contentType = "video/wav";
		const bucket = ENV_CONFIG.GCS_ASSETS_BUCKET;
		await uploadToS3(audioBuffer, key, contentType, bucket);

		const expiresIn = 3600 * 24 * 6.9; // A bit less than a week
		const signedUrl = await generateSignedUrl(key, bucket, expiresIn);
		const signedUrlExp = new Date(Date.now() + expiresIn * 1000);

		const asset = await prisma.fileAsset.create({
			data: {
				name: fileName,
				bucket,
				key,
				signedUrl,
				signedUrlExp,
				userId: data.canvas.userId,
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

		const newGeneration: TextToSpeechResult["outputs"][number] = {
			items: [
				{
					type: DataType.Audio,
					data: { entity: asset },
					outputHandleId: outputHandle.id,
				},
			],
		};

		newResult.outputs.push(newGeneration);
		newResult.selectedOutputIndex = newResult.outputs.length - 1;

		return { success: true, newResult };
	} catch (err: unknown) {
		console.log(err);
		if (err instanceof Error) {
			logger.error(err.message);
			return {
				success: false,
				error: err?.message ?? "TextToSpeech processing failed",
			};
		}
		return { success: false, error: "TextToSpeech processing failed" };
	}
};

export default textToSpeechProcessor;
