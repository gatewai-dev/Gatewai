import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { aisdk } from "@openai/agents-extensions";
import { ENV_CONFIG } from "../config.js";

// 1. Define your desired timeout in milliseconds (e.g., 60 seconds)
const REQUEST_TIMEOUT_MS = 60000;

const googleProvider = createGoogleGenerativeAI({
    apiKey: ENV_CONFIG.GEMINI_API_KEY,
    fetch: async (url, options) => {
        // 2. Create an AbortController for the timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

        try {
            const response = await fetch(url, {
                ...options,
                // @ts-ignore - dispatcher is specific to undici/node-fetch environments
                dispatcher: options.dispatcher, 
                signal: controller.signal, // 3. Attach the signal here
            });
            return response;
        } finally {
            // 4. Always clear timeout to prevent memory leaks
            clearTimeout(timeoutId);
        }
    },
});

export const AVAILABLE_AGENT_MODELS = [
    "gemini-3-pro-preview",
    "gemini-3-flash-preview",
] as const;

export function getAgentModel(name: (typeof AVAILABLE_AGENT_MODELS)[number]) {
    return aisdk(googleProvider(name));
}