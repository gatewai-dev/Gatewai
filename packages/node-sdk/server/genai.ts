import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * Default client for the google gemini
 */

const getGenAIClient = (apiKey: string) => {
	const genAI = new GoogleGenerativeAI(apiKey);
	return genAI;
};

export { getGenAIClient };
