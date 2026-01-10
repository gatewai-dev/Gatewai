import { config } from "dotenv";

config();

type EnvConfig = {
	BACKEND_URL: string;
	PORT: number;
	REDIS_HOST: string;
	REDIS_PORT: string;
	REDIS_PASSWORD: string;
	GEMINI_API_KEY: string;
	GCS_ASSETS_BUCKET: string;
	GOOGLE_APPLICATION_CREDENTIALS: string;
	GOOGLE_CLIENT_ID: string;
	GOOGLE_CLIENT_SECRET: string;
};

if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
	throw new Error(
		"Missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET env variable(s)",
	);
}

if (!process.env.GEMINI_API_KEY) {
	throw new Error("Missing GEMINI_API_KEY env variable");
}

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
	throw new Error("Missing GOOGLE_APPLICATION_CREDENTIALS env variable");
}

if (!process.env.GCS_ASSETS_BUCKET) {
	throw new Error("Missing GCS_ASSETS_BUCKET env variable");
}

if (!process.env.BACKEND_URL) {
	throw new Error("Missing BACKEND_URL env variable");
}

if (!process.env.REDIS_PORT) {
	throw new Error("Missing REDIS_PORT env variable");
}
if (!process.env.REDIS_HOST) {
	throw new Error("Missing REDIS_HOST env variable");
}
if (!process.env.REDIS_PASSWORD) {
	throw new Error("Missing REDIS_PASSWORD env variable");
}

export const ENV_CONFIG: EnvConfig = {
	BACKEND_URL: process.env.BACKEND_URL,
	REDIS_HOST: process.env.REDIS_HOST,
	REDIS_PASSWORD: process.env.REDIS_PASSWORD,
	REDIS_PORT: process.env.REDIS_PORT,
	PORT: Number(process.env.PORT),
	GEMINI_API_KEY: process.env.GEMINI_API_KEY,
	GCS_ASSETS_BUCKET: process.env.GCS_ASSETS_BUCKET,
	GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS,
	GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
	GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
};
