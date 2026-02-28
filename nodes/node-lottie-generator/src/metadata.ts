import { defineMetadata } from "@gatewai/node-sdk";
import { LottieNodeConfigSchema, LottieResultSchema } from "./shared/index.js";

export { LottieNodeConfigSchema, LottieResultSchema };

export const metadata = defineMetadata({
	type: "LottieGen",
	displayName: "Lottie Generator",
	description: "Generate Lottie animations using an AI model.",
	category: "AI",
	configSchema: LottieNodeConfigSchema,
	resultSchema: LottieResultSchema,
	isTerminal: true,
	isTransient: false,
	variableInputs: { enabled: true, dataTypes: ["Lottie"] },
	handles: {
		inputs: [
			{ dataTypes: ["Text"], required: true, label: "Prompt", order: 0 },
			{ dataTypes: ["Lottie"], label: "Source Lottie (Editing)", order: 1 },
		],
		outputs: [{ dataTypes: ["Lottie"], label: "Result", order: 0 }],
	},
	defaultConfig: { model: "gemini-3-flash-preview", temperature: 0 },
});
