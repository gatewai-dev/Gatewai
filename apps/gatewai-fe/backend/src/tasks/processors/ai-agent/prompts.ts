import type { Schema } from "@google/genai";

export const SYSTEM_PROMPT_SUFFIX_BUILDER = (
	schema: Schema,
) => `Use the tools provided to you to generate the
required outputs as per the user's instructions.
Ensure that you adhere to the output schema and provide accurate and relevant information.
If you encounter any issues or need clarification, refer back to the user's instructions.

Generate a document that summaries the outputs based on the user's instructions and the data you have processed.
Below is the output schema required for final output for reference:

${JSON.stringify(schema, null, 2)}

Make sure all information exists in the final output schema.

When you're done, use the Result_Generator_Tool to generate the final output according to the schema provided.
.`;
