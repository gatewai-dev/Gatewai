import { z } from "zod";

export const STT_NODE_MODELS = [
	"gemini-3-pro-preview",
	"gemini-3-flash-preview",
] as const;

export const SpeechToTextNodeConfigSchema = z
	.object({
		model: z.enum(STT_NODE_MODELS),
	})
	.strict();

export type SpeechToTextNodeConfig = z.infer<
	typeof SpeechToTextNodeConfigSchema
>;
