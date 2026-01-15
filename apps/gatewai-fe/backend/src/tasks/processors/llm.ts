import assert from "node:assert";
import { DataType } from "@gatewai/db";
import type { FileData, LLMNodeConfig, LLMResult } from "@gatewai/types";
import type { Part } from "@google/genai";
import { genAI } from "../../genai.js";
import { getFromGCS } from "../../utils/storage.js";
import { getInputValue } from "../resolvers.js";
import type { NodeProcessor } from "./types.js";

const llmProcessor: NodeProcessor = async ({ node, data }) => {
	try {
		const systemPrompt = getInputValue(data, node.id, false, {
			dataType: DataType.Text,
			label: "System Prompt",
		})?.data as string | null;

		const userPrompt = getInputValue(data, node.id, true, {
			dataType: DataType.Text,
			label: "Prompt",
		})?.data as string;

		const imageFileData = getInputValue(data, node.id, false, {
			dataType: DataType.Image,
			label: "Image",
		})?.data as FileData | null;

		// 1. Prepare User Content Parts
		const parts: Part[] = [];

		if (userPrompt) {
			parts.push({ text: userPrompt });
		}

		// 2. Handle Image Processing (URL -> Base64 for Google SDK)
		const imageData = imageFileData?.entity ?? imageFileData?.processData;

		if (imageData) {
			let mimeType: string | undefined;
			let key: string | undefined;
			let bucket: string | undefined;

			if (imageFileData?.entity) {
				key = imageFileData.entity.key;
				bucket = imageFileData.entity.bucket;
				mimeType = imageFileData.entity.mimeType;
			} else if (imageFileData?.processData) {
				key = imageFileData.processData.tempKey;
				mimeType = imageFileData.processData.mimeType;
				bucket = undefined;
			} else {
				throw new Error("Image data could not be found");
			}
			assert(key);
			assert(mimeType);
			const arrayBuffer = await getFromGCS(key, bucket);
			const buffer = Buffer.from(arrayBuffer);
			const base64Data = buffer.toString("base64");

			parts.push({
				inlineData: {
					mimeType,
					data: base64Data,
				},
			});
		}

		if (parts.length === 0) {
			return { success: false, error: "No user prompt or image provided" };
		}

		// 3. Generate Content
		const nodeConfig = node.config as LLMNodeConfig;

		const response = await genAI.models.generateContent({
			model: nodeConfig.model,
			contents: [
				{
					role: "user",
					parts: parts,
				},
			],
			config: {
				// Map system prompt to systemInstruction
				systemInstruction: systemPrompt
					? { parts: [{ text: systemPrompt }] }
					: undefined,
			},
		});

		// 4. Extract Result
		const generatedText = response.text;

		if (!generatedText) {
			throw new Error("Unable to generate text");
		}

		const outputHandle = data.handles.find(
			(h) => h.nodeId === node.id && h.type === "Output",
		);
		if (!outputHandle)
			return { success: false, error: "Output handle is missing." };

		const newResult = structuredClone(node.result as unknown as LLMResult) ?? {
			outputs: [],
			selectedOutputIndex: 0,
		};

		const newGeneration: LLMResult["outputs"][number] = {
			items: [
				{
					type: DataType.Text,
					data: generatedText,
					outputHandleId: outputHandle.id,
				},
			],
		};

		newResult.outputs.push(newGeneration);
		newResult.selectedOutputIndex = newResult.outputs.length - 1;

		return { success: true, newResult };
	} catch (err: unknown) {
		if (err instanceof Error) {
			return { success: false, error: err.message };
		}
		return { success: false, error: "LLM processing failed" };
	}
};

export default llmProcessor;
