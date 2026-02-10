import {
	logger,
} from "@gatewai/core";
import { DataType } from "@gatewai/db";
import type { BackendNodeProcessor } from "@gatewai/node-sdk";
import type {
	OutputItem,
	SpeechToTextNodeConfig,
	SpeechToTextResult,
} from "@gatewai/types";
import { getGenAIClient } from '../genai.js'
import { createPartFromUri, createUserContent } from "@google/genai";

const audioUnderstandingProcessor: BackendNodeProcessor = async ({
	node,
	data,
	services,
}) => {
	try {
		const userPrompt = services.getInputValue(data, node.id, true, {
			dataType: DataType.Text,
			label: "Prompt",
		})?.data as string;

		const audioInput = services.getInputValue(data, node.id, true, {
			dataType: DataType.Audio,
			label: "Audio",
		})?.data as OutputItem<"Audio">["data"];

		const nodeConfig = node.config as SpeechToTextNodeConfig;

		let fileBlob: Blob;
		let mimeType: string;
		if (audioInput?.entity?.signedUrl) {
			const buffer = await services.getFromGCS(
				audioInput.entity.key,
				audioInput.entity.bucket,
			);
			fileBlob = new Blob([new Uint8Array(buffer)], {
				type: audioInput.entity.mimeType,
			});
			mimeType = audioInput.entity.mimeType;
		} else if (audioInput?.processData?.tempKey) {
			const buffer = await services.getFromGCS(audioInput?.processData.tempKey);
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
		const genAI = getGenAIClient(services.env.GEMINI_API_KEY);

		const audioFile = await genAI.files.upload({
			file: fileBlob,
			config: { mimeType },
		});

		if (!audioFile.uri || !audioFile.mimeType) {
			return { success: false, error: "Uploaded audio data is corrupted." };
		}

		const response = await genAI.models.generateContent({
			model: nodeConfig.model,
			contents: createUserContent([
				createPartFromUri(audioFile.uri, audioFile.mimeType),
				userPrompt,
			]),
		});

		if (!response.text) return { success: false, error: "Response is empty." };

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
			],
		});
		newResult.selectedOutputIndex = newResult.outputs.length - 1;

		return { success: true, newResult };
	} catch (err: unknown) {
		logger.error(err instanceof Error ? err.message : "TTS Failed");
		return { success: false, error: "AudioUnderstanding processing failed" };
	}
};

export default audioUnderstandingProcessor;
