import { FunctionTool } from "@google/adk";
import type { Schema } from "@google/genai";
import { z } from "zod";
import { genAI } from "../../../../genai.js";

const params = z.object({
	output_summary: z.string().describe("The output summary."),
});
type ToolInputParameters = z.infer<typeof params>;

export const createResultGeneratorTool: (
	responseJsonSchema: Schema,
) => FunctionTool<any> = (responseJsonSchema: Schema) =>
	new FunctionTool({
		name: "Result_Generator_Tool",
		parameters: params,
		description:
			"Generates the final output according to the provided schema from the AI Agent.",
		execute: async (input) => {
			console.log({ input });
			const response = await genAI.models.generateContent({
				model: "gemini-2.5-flash", // We don't need extra intelligence here
				contents: `Agent Output Summary: ${JSON.stringify(input)}\n\nGenerate the final output conforming to the required schema.`,
				config: {
					responseMimeType: "application/json",
					responseJsonSchema,
				},
			});
			console.log("SCHO", response.text);
			// This function can be expanded to include any processing logic if needed.
			return JSON.parse(response.text as string);
		},
	});
