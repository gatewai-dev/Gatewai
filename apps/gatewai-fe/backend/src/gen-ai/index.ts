import { GoogleGenAI } from "@google/genai";
import { ENV_CONFIG } from "../config.js";

const genAI = new GoogleGenAI({ apiKey: ENV_CONFIG.GEMINI_API_KEY });

export { genAI };
