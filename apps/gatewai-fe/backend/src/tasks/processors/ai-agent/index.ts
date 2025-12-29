import type { DataType } from "@gatewai/db";
import type {
	AgentNodeConfig,
	FileData,
	NodeResult,
	Output,
	OutputItem,
} from "@gatewai/types";
import { Agent, type AgentInputItem, Runner } from "@openai/agents";
import { aisdk } from "@openai/agents-extensions";
import { gateway } from "ai";
import {
	type UnknownKeysParam,
	type ZodObject,
	type ZodRawShape,
	z,
} from "zod";
import {
	getAllInputValuesWithHandle,
	getAllOutputHandles,
	resolveFileUrl,
} from "../../resolvers.js";
import type { NodeProcessor, NodeProcessorCtx } from "../types.js";

export const FileAssetSchema = z.object({
	id: z.string().cuid(),
	name: z.string(),
	createdAt: z.date(),
	updatedAt: z.date(),
	width: z.number().int().positive().nullable(),
	height: z.number().int().positive().nullable(),
	bucket: z.string(),
	mimeType: z.string(),
	key: z.string(),
	signedUrl: z.string().url().nullable(),
	signedUrlExp: z.date().nullable(),
	userId: z.string(),
	isUploaded: z.boolean().default(true),
});

function CreateOutputZodSchema(
	outputHandles: NodeProcessorCtx["data"]["handles"],
) {
	const typeMap: Record<string, z.ZodTypeAny> = {
		Text: z.string(),
		Number: z.number(),
		Boolean: z.boolean(),
	};

	let fieldSchema: ZodRawShape = {};
	for (const handle of outputHandles) {
		const outputHandleId = handle.id;
		const dataType = handle.dataTypes[0];
		let handleZodObject: ZodObject<ZodRawShape, UnknownKeysParam> | undefined;
		if (
			dataType === "File" ||
			dataType === "Image" ||
			dataType === "Audio" ||
			dataType === "Video"
		) {
			handleZodObject = z.object({
				outputHandleId: z.literal(outputHandleId),
				data: z.object({
					file: z.object({
						entity: FileAssetSchema.optional(),
						dataUrl: z.string().optional(),
					}),
				}),
				type: z.literal(dataType),
			});
		} else {
			const zodType = typeMap[dataType];
			if (!zodType) {
				throw new Error(`Unsupported data type: ${dataType}`);
			}
			handleZodObject = z.object({
				outputHandleId: z.literal(outputHandleId),
				data: zodType,
				type: z.literal(dataType),
			});
		}
		const content = {
			[outputHandleId]: handleZodObject,
		};

		fieldSchema = {
			...fieldSchema,
			...content,
		};
	}

	return z.object(fieldSchema);
}

const aiAgentProcessor: NodeProcessor = async ({ node, data }) => {
	try {
		const allInputs = getAllInputValuesWithHandle(data, node.id);
		const systemPromptData = allInputs.find(
			(input) => input?.handle?.label === "System Prompt",
		);
		const systemPrompt = systemPromptData?.value as string | null;
		if (!systemPrompt) {
			return { success: false, error: "System Prompt is required" };
		}
		const prompt = allInputs.find(
			(input) => input?.handle?.label === "Instructions",
		)?.value as string;
		if (!prompt) {
			return { success: false, error: "Instructions is required" };
		}

		const outputs = getAllOutputHandles(data, node.id);
		const jsonSchema = CreateOutputZodSchema(outputs);
		const config = node.config as unknown as AgentNodeConfig;
		const dynamicInputs = allInputs.filter((input) => {
			return (
				input?.handle &&
				input.handle.id !== systemPromptData?.handle?.id &&
				input.handle.id !== systemPromptData?.handle?.id
			);
		});
		type AgentContext = typeof dynamicInputs;

		const agentModel = aisdk(gateway(config.model));
		const agent = new Agent<AgentContext>({
			instructions: systemPrompt,
			name: node.name,
			outputType: jsonSchema,
		});
		const runner = new Runner({
			model: agentModel,
		});

		const inputItems: AgentInputItem[] = [
			{ role: "user", content: [{ type: "input_text", text: prompt }] },
		];

		for (const input of dynamicInputs) {
			if (!input.handle) continue;
			if (
				input.handle.dataTypes[0] === "Text" ||
				input.handle.dataTypes[0] === "Boolean" ||
				input.handle.dataTypes[0] === "Number"
			) {
				inputItems.push({
					role: "user",
					content: [
						{
							type: "input_text",
							text: `${input.handle.label} ${input.handle.description}: ${input.value}` as string,
						},
					],
				});
			} else if (input.handle.dataTypes[0] === "Image") {
				const fileData = input.value as FileData;
				const file_url = await resolveFileUrl(fileData);
				if (file_url) {
					inputItems.push({
						role: "user",
						content: [{ type: "input_image", image: file_url }],
					});
				}
			} else if (input.handle.dataTypes[0] === "File") {
				const fileData = input.value as FileData;
				const file_url = await resolveFileUrl(fileData);
				if (file_url) {
					inputItems.push({
						role: "user",
						content: [{ type: "input_file", file: { url: file_url } }],
					});
				}
			} else if (input.handle.dataTypes[0] === "Audio") {
				const fileData = input.value as FileData;
				const file_url = await resolveFileUrl(fileData);
				if (file_url) {
					inputItems.push({
						role: "user",
						content: [{ type: "audio", audio: file_url }],
					});
				}
			}
		}

		const run = await runner.run(agent, inputItems, {
			maxTurns: config.maxTurns || 10,
		});
		const output = run.finalOutput as unknown as z.infer<
			ReturnType<typeof CreateOutputZodSchema>
		>;
		const newItems = Object.values(output) as OutputItem<DataType>[];

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
			return { success: false, error: err?.message ?? "LLM processing failed" };
		}
		return { success: false, error: "LLM processing failed" };
	}
};

export default aiAgentProcessor;
