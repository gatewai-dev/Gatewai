import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { aisdk } from "@openai/agents-extensions";
import { ENV_CONFIG } from "../config.js";

const googleProvider = createGoogleGenerativeAI({
	apiKey: ENV_CONFIG.GEMINI_API_KEY,
});
export const agentModel = aisdk(googleProvider("gemini-3-flash-preview"));
