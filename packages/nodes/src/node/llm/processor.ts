import assert from "node:assert";
import type { FileData, LLMResult } from "@gatewai/core/types";
import { DataType } from "@gatewai/db";
import type {
	BackendNodeProcessorCtx,
	BackendNodeProcessorResult,
	NodeProcessor,
} from "@gatewai/node-sdk";
import { LLMNodeConfigSchema } from "../../configs/llm.config.js";
import { TOKENS } from "@gatewai/core/di";
import { inject, injectable } from "tsyringe";
import type { EnvConfig } from "@gatewai/core";
import { type GraphResolvers } from "@gatewai/node-sdk";
import { getGenAIClient } from "../genai.js";

@injectable()
export default class LLMProcessor implements NodeProcessor {
	constructor(
		@inject(TOKENS.ENV) private env: EnvConfig,
		@inject(TOKENS.GRAPH_RESOLVERS) private graph: GraphResolvers,
	) { }

	async process(
		ctx: BackendNodeProcessorCtx,
	): Promise<BackendNodeProcessorResult> {
		const { node, data } = ctx;
		const genAI = getGenAIClient(this.env.GEMINI_API_KEY);
		try {
			const systemPrompt = this.graph.getInputValue(data, node.id, false, {
				dataType: DataType.Text,
				label: "System Prompt",
			})?.data as string | null;

			const userPrompt = this.graph.getInputValue(data, node.id, true, {
				dataType: DataType.Text,
				label: "Prompt",
			})?.data as string | null;

			const imageFileData = this.graph.getInputValue(data, node.id, false, {
				dataType: DataType.Image,
				label: "Image",
			})?.data as FileData | null;

			const parts: Array<Record<string, unknown>> = [];

			if (userPrompt) {
				parts.push({ text: userPrompt });
			}

			if (imageFileData) {
				const mimeType = await this.graph.getFileDataMimeType(imageFileData);
				assert(mimeType);
				const arrayBuffer = await this.graph.loadMediaBuffer(imageFileData);
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

			const nodeConfig = LLMNodeConfigSchema.parse(node.config);

			const response = (await genAI.models.generateContent({
				model: nodeConfig.model ?? "gemini-1.5-pro",
				contents: [
					{
						role: "user",
						parts: parts,
					},
				],
				config: {
					systemInstruction: systemPrompt
						? { parts: [{ text: systemPrompt }] }
						: undefined,
				},
			})) as { text?: string };

			const generatedText = response.text;

			if (!generatedText) {
				throw new Error("Unable to generate text");
			}

			const outputHandle = data.handles.find(
				(h) => h.nodeId === node.id && h.type === "Output",
			);
			if (!outputHandle)
				return { success: false, error: "Output handle is missing." };

			const newResult = structuredClone(
				node.result as unknown as LLMResult,
			) ?? {
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
	}
}
