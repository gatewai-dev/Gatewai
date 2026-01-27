import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { aisdk } from "@openai/agents-extensions";
import { ENV_CONFIG } from "../config.js";

const googleProvider = createGoogleGenerativeAI({
	apiKey: ENV_CONFIG.GEMINI_API_KEY,
});

const AVAILABLE_MODELS = [
	"gemini-3-pro-preview",
	"gemini-3-flash-preview",
] as const;

export function getAgentModel(name: (typeof AVAILABLE_MODELS)[number]) {
	return aisdk(googleProvider(name));
}

export const agentModel = aisdk(googleProvider("gemini-3-pro-preview"));
