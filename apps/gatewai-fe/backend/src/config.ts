import { config } from "dotenv";

config();

type EnvConfig = {
	PORT: number;
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

export const ENV_CONFIG: EnvConfig = {
	PORT: Number(process.env.PORT),
	GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
	GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
	AWS_ASSETS_BUCKET: process.env.AWS_ASSETS_BUCKET,
};
