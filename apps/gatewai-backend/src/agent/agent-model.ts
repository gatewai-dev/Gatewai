import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { ENV_CONFIG } from "@gatewai/core";
import { aisdk } from "@openai/agents-extensions";

import { createResilientFetch } from "../lib/resilient-fetch.js";

// 1. Define your desired timeout in milliseconds (e.g., 60 seconds)
const REQUEST_TIMEOUT_MS = 60000;

const resilientFetch = createResilientFetch({
	timeout: REQUEST_TIMEOUT_MS,
	retries: 3,
	retryDelay: 1000,
});

const googleProvider = createGoogleGenerativeAI({
	apiKey: ENV_CONFIG.GEMINI_API_KEY,
	fetch: resilientFetch,
});

export const AVAILABLE_AGENT_MODELS = [
	"gemini-3.1-pro-preview",
	"gemini-3-flash-preview",
	"gemini-2.5-pro",
] as const;

export function getAgentModel(name: (typeof AVAILABLE_AGENT_MODELS)[number]) {
	return aisdk(googleProvider(name));
}
