import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { GoogleGenAI } from "@google/genai";
import { ENV_CONFIG } from "./config.js";

/**
 * Default client for the google gemini
 */
const genAI = new GoogleGenAI({
	apiKey: ENV_CONFIG.GEMINI_API_KEY,
});

/**
 * Gemini client for ai sdk of vercels
 */
const aiSDKGenAI = createGoogleGenerativeAI({
	apiKey: ENV_CONFIG.GEMINI_API_KEY,
});

export { genAI, aiSDKGenAI };
