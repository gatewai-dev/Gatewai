import { config } from "dotenv";

config();

type EnvConfig = {
	PORT: number;
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

export const ENV_CONFIG: EnvConfig = {
	PORT: Number(process.env.PORT),
	GEMINI_API_KEY: process.env.GEMINI_API_KEY,
	GCS_ASSETS_BUCKET: process.env.GCS_ASSETS_BUCKET,
	GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS,
	GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
	GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
};
