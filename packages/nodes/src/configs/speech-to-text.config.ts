import { z } from "zod";

export const STT_NODE_MODELS = [
	"gemini-2.5-flash",
	"gemini-3-flash-preview",
	"gemini-3-pro-preview",
] as const;

export const SpeechToTextNodeConfigSchema = z
	.object({
		model: z.enum(STT_NODE_MODELS).default("gemini-2.5-flash"),
	})
	.strict();

export type SpeechToTextNodeConfig = z.infer<
	typeof SpeechToTextNodeConfigSchema
>;
