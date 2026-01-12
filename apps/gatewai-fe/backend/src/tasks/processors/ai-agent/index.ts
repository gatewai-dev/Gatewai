import assert from "node:assert";
import type { DataType } from "@gatewai/db";
import type {
	AgentNodeConfig,
	FileData,
	NodeResult,
	Output,
	OutputItem,
} from "@gatewai/types";
import { InMemorySessionService, LlmAgent, Runner } from "@google/adk";
import { type Part, type Schema, Type } from "@google/genai";
import { ENV_CONFIG } from "../../../config.js";
import { urlToBase64 } from "../../../utils/file-utils.js";
import {
	getAllInputValuesWithHandle,
	getAllOutputHandles,
	resolveFileUrl,
} from "../../resolvers.js";
import type { NodeProcessor, NodeProcessorCtx } from "../types.js";
import { AgentNodeArtifactService } from "./artifact-service.js";

// --- Definitions ---

const FileAssetGeminiSchema: Schema = {
	type: Type.OBJECT,
	properties: {
		id: { type: Type.STRING },
		name: { type: Type.STRING },
		createdAt: { type: Type.STRING },
		updatedAt: { type: Type.STRING },
		width: { type: Type.INTEGER, nullable: true },
		height: { type: Type.INTEGER, nullable: true },
		bucket: { type: Type.STRING },
		size: { type: Type.INTEGER },
		mimeType: { type: Type.STRING },
		key: { type: Type.STRING },
		signedUrl: { type: Type.STRING, nullable: true },
		signedUrlExp: { type: Type.STRING, nullable: true },
		isUploaded: { type: Type.BOOLEAN },
		duration: { type: Type.INTEGER, nullable: true },
		fps: { type: Type.INTEGER, nullable: true },
		metadata: { type: Type.OBJECT, properties: {}, nullable: true },
	},
	required: [
		"id",
		"name",
		"createdAt",
		"updatedAt",
		"bucket",
		"size",
		"mimeType",
		"key",
		"isUploaded",
	],
};

/**
 * Creates the Gemini Schema directly for the output
 */
function CreateOutputSchema(
	outputHandles: NodeProcessorCtx["data"]["handles"],
): Schema {
	const typeMap: Record<string, Type> = {
		Text: Type.STRING,
		Number: Type.NUMBER,
		Boolean: Type.BOOLEAN,
	};

	const properties: { [key: string]: Schema } = {};
	const required: string[] = [];

	for (const handle of outputHandles) {
		const outputHandleId = handle.id;
		required.push(outputHandleId);
		const dataType = handle.dataTypes[0];
		let dataSchema: Schema;

		if (dataType === "Image" || dataType === "Audio" || dataType === "Video") {
			const processDataSchema: Schema = {
				type: Type.OBJECT,
				properties: {
					dataUrl: { type: Type.STRING, nullable: true },
					width: { type: Type.NUMBER, nullable: true },
					height: { type: Type.NUMBER, nullable: true },
					duration: {
						type: Type.NUMBER,
						nullable: true,
						description: "Duration in milliseconds",
					},
				},
				required: [],
			};

			const fileSchema: Schema = {
				type: Type.OBJECT,
				properties: {
					entity: { ...FileAssetGeminiSchema, nullable: true },
					processData: processDataSchema,
				},
				required: ["processData"],
			};

			dataSchema = {
				type: Type.OBJECT,
				properties: {
					file: fileSchema,
				},
				required: ["file"],
			};
		} else {
			const geminiType = typeMap[dataType];
			if (!geminiType) {
				throw new Error(`Unsupported data type: ${dataType}`);
			}
			dataSchema = { type: geminiType };
		}

		properties[outputHandleId] = {
			type: Type.OBJECT,
			properties: {
				outputHandleId: { type: Type.STRING, enum: [outputHandleId] },
				data: dataSchema,
				type: { type: Type.STRING, enum: [dataType] },
			},
			required: ["outputHandleId", "data", "type"],
		};
	}

	return {
		type: Type.OBJECT,
		properties,
		required,
	};
}

const aiAgentProcessor: NodeProcessor = async ({ node, data }) => {
	try {
		assert(data.task, "Task data is missing in processor context");
		// 1. Setup Inputs
		const allInputs = getAllInputValuesWithHandle(data, node.id);
		const systemPromptData = allInputs.find(
			(input) => input?.handle?.label === "System Prompt",
		);
		const systemPrompt = systemPromptData?.value?.data as string | null;
		if (!systemPrompt) {
			return { success: false, error: "System Prompt is required" };
		}

		const prompt = allInputs.find(
			(input) => input?.handle?.label === "Instructions",
		)?.value?.data as string;
		if (!prompt) {
			return { success: false, error: "Instructions is required" };
		}

		// 2. Setup Configuration
		const config = node.config as unknown as AgentNodeConfig;

		// 3. Prepare Schema
		const outputs = getAllOutputHandles(data, node.id);
		const googleSchema = CreateOutputSchema(outputs);

		const rootAgent = new LlmAgent({
			model: config.model,
			name: node.name || "AI Agent",
			outputSchema: googleSchema,
			instruction: prompt,
		});

		const resultGeneratorAgent = new LlmAgent({
			model: config.model,
			name: node.name || "AI Agent",
			outputSchema: googleSchema,
			instruction:
				"Generate output according to the provided information and schema.",
		});

		// 5. Build Content Parts (Multimodal inputs)
		const dynamicInputs = allInputs.filter((input) => {
			return (
				input?.handle &&
				input.handle.id !== systemPromptData?.handle?.id &&
				input.handle.label !== "Instructions" // Exclude the main prompt instructions handled above
			);
		});

		const userParts: Part[] = [];

		// Add the main instruction prompt first
		userParts.push({ text: prompt });

		for (const input of dynamicInputs) {
			if (!input.handle) continue;
			const dataType = input.handle.dataTypes[0];

			if (
				dataType === "Text" ||
				dataType === "Boolean" ||
				dataType === "Number"
			) {
				userParts.push({
					text: `${input.handle.label} ${input.handle.description || ""}: ${input.value}`,
				});
			} else if (["Image", "Video", "Audio"].includes(dataType)) {
				const fileData = input.value as FileData;
				const fileUrl = await resolveFileUrl(fileData);

				if (fileUrl) {
					try {
						const base64Data = await urlToBase64(fileUrl);

						// Determine MimeType (Fallback to generic if missing from fileData)
						const mimeType =
							fileData.entity?.mimeType ||
							(dataType === "Image"
								? "image/jpeg"
								: dataType === "Audio"
									? "audio/mp3"
									: "video/mp4");

						userParts.push({
							inlineData: {
								data: base64Data,
								mimeType: mimeType,
							},
						});
					} catch (e) {
						console.error(
							`Failed to process file input ${input.handle.label}`,
							e,
						);
						// Optionally continue or fail
					}
				}
			}
		}

		const runner = new Runner({
			agent: rootAgent,
			appName: "Gatewai AI Agent Node Processor",
			sessionService: new InMemorySessionService(),
			artifactService: new AgentNodeArtifactService(
				ENV_CONFIG.GCS_ASSETS_BUCKET,
			),
		});

		// 6. Execute Generation
		const result = runner.runAsync({
			sessionId: data.task.id,
			userId: "system",
			newMessage: {
				parts: [
					{
						text: prompt,
					},
				],
			},
		});

		async function consumeIterator() {
			for await (const value of result) {
				console.log("Received:", value);
			}
			console.log("Done!");
		}

		// Parse JSON
		let parsedJson;
		try {
			parsedJson = JSON.parse(responseText);
		} catch (e) {
			return {
				success: false,
				error: "Failed to parse JSON response from model",
			};
		}

		// 8. Construct Node Result
		const newItems = Object.values(parsedJson) as OutputItem<DataType>[];

		const newResult: NodeResult = structuredClone(
			node.result as NodeResult,
		) ?? {
			outputs: [],
			selectedOutputIndex: 0,
		};

		const newGeneration: Output = {
			items: newItems,
		};

		newResult.outputs.push(newGeneration);
		newResult.selectedOutputIndex = newResult.outputs.length - 1;

		return { success: true, newResult };
	} catch (err: unknown) {
		if (err instanceof Error) {
			return { success: false, error: err.message };
		}
		return {
			success: false,
			error: "LLM processing failed with unknown error",
		};
	}
};

export default aiAgentProcessor;
