import { DataType } from "@gatewai/db";
import type {
	OutputItem,
	SpeechToTextNodeConfig,
	SpeechToTextResult,
} from "@gatewai/types";
import { createPartFromUri, createUserContent } from "@google/genai";
import { genAI } from "../../genai.js";
import { logger } from "../../logger.js";
import { getInputValue } from "../resolvers.js";
import type { NodeProcessor } from "./types.js";

const audioUnderstandingProcessor: NodeProcessor = async ({ node, data }) => {
	try {
		const userPrompt = getInputValue(data, node.id, true, {
			dataType: DataType.Text,
			label: "Prompt",
		})?.data as string;

		const audioInput = getInputValue(data, node.id, true, {
			dataType: DataType.Audio,
			label: "Audio",
		})?.data as OutputItem<"Audio">["data"];

		const nodeConfig = node.config as SpeechToTextNodeConfig;

		let fileBlob: Blob;
		console.log({ audioInput });
		if (audioInput?.entity?.signedUrl) {
			fileBlob = await (await fetch(audioInput.entity?.signedUrl)).blob();
		} else if (audioInput?.processData?.dataUrl) {
			const buf = Buffer.from(audioInput?.processData?.dataUrl, "base64");
			fileBlob = new Blob([buf]);
		} else {
			return {
				success: false,
				error: "Input audio data could not be resolved",
			};
		}

		const audioFile = await genAI.files.upload({
			file: fileBlob,
			config: { mimeType: "audio/wav" },
		});

		if (!audioFile.uri || !audioFile.mimeType) {
			return { success: false, error: "Uploaded audio data is corrupted." };
		}

		const response = await genAI.models.generateContent({
			model: nodeConfig.model || "gemini-2.5-flash",
			contents: createUserContent([
				createPartFromUri(audioFile.uri, audioFile.mimeType),
				userPrompt,
			]),
		});
		console.log("ANAN", response.text);
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
