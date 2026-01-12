import { BlurNodeConfigSchema } from "@gatewai/types";
import { FunctionTool } from "@google/adk";
import type { Part } from "@google/genai";
import { z } from "zod";
import { backendPixiService } from "../../../../../media/pixi-processor.js";
export const BLUR_TOOL_NAME = "BLUR_TOOL";

const BlurToolParamsSchema = BlurNodeConfigSchema.extend({
	image_url: z.string(),
});

const BlurTool = new FunctionTool({
	name: BLUR_TOOL_NAME,
	parameters: BlurToolParamsSchema,
	async execute(input, tool_context) {
		const { dataUrl } = await backendPixiService.processBlur(input.image_url, {
			blurSize: input.size ?? 0,
		});
		const artifact: Part = {
			fileData: {
				fileUri: dataUrl,
			},
		};
		tool_context?.saveArtifact(blur_filename);

		return { dataUrl };
	},
});
