import { GoogleGenAI } from "@google/genai";

/**
 * Default client for the google gemini
 */

const getGenAIClient = (apiKey: string) => {
	const genAI = new GoogleGenAI({
		apiKey,
	});
	return genAI;
};

export { getGenAIClient };
