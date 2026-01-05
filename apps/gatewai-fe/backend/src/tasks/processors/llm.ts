import { DataType } from "@gatewai/db";
import type { FileData, LLMNodeConfig, LLMResult } from "@gatewai/types";
import { GoogleGenAI, type Part } from "@google/genai";
import { getInputValue } from "../resolvers.js";
import type { NodeProcessor } from "./types.js";

const llmProcessor: NodeProcessor = async ({ node, data }) => {
	try {
		// Initialize Google Client
		// Ensure process.env.GOOGLE_API_KEY is set in your environment
		const client = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY });

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
		const imageData =
			imageFileData?.entity?.signedUrl ?? imageFileData?.processData?.dataUrl;

		if (imageData) {
			let base64Data: string;
			let mimeType: string;

			if (imageData.startsWith("data:")) {
				// Handle Data URL
				const matches = imageData.match(/^data:(.+);base64,(.+)$/);
				if (!matches || matches.length !== 3) {
					throw new Error("Invalid data URL format");
				}
				mimeType = matches[1];
				base64Data = matches[2];
			} else {
				// Handle Remote URL (Signed URL) - Must fetch and convert to buffer
				const response = await fetch(imageData);
				if (!response.ok) {
					throw new Error(`Failed to fetch image: ${response.statusText}`);
				}
				const arrayBuffer = await response.arrayBuffer();
				const buffer = Buffer.from(arrayBuffer);

				mimeType = response.headers.get("content-type") ?? "image/png";
				base64Data = buffer.toString("base64");
			}

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

		const response = await client.models.generateContent({
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
		if (!outputHandle) throw new Error("Output handle is missing");

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
		// Improved error logging for Google SDK specific errors
		if (err instanceof Error) {
			return { success: false, error: err.message };
		}
		return { success: false, error: "LLM processing failed" };
	}
};

export default llmProcessor;
