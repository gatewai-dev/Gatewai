import { config } from "dotenv";

config();

type EnvConfig = {
	PORT: number;
	GEMINI_API_KEY: string;
	GOOGLE_APPLICATION_CREDENTIALS: string;
	GOOGLE_CLIENT_ID: string;
	GOOGLE_CLIENT_SECRET: string;
	AWS_ASSETS_BUCKET: string;
};

if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
	throw new Error("Client ID and Secret is not set for google");
}

if (!process.env.AWS_ASSETS_BUCKET) {
	throw new Error("Bucket is not set.");
}

if (!process.env.GEMINI_API_KEY) {
	throw new Error("Missing GEMINI API KEY");
}

if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
	throw new Error("Missing GOOGLE_APPLICATION_CREDENTIALS");
}

export const ENV_CONFIG: EnvConfig = {
	PORT: Number(process.env.PORT),
	GEMINI_API_KEY: process.env.GEMINI_API_KEY,
	GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS,
	GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
	GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
	AWS_ASSETS_BUCKET: process.env.AWS_ASSETS_BUCKET,
};
