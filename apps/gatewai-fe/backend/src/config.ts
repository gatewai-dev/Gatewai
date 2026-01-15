import { config } from "dotenv";
import { z } from "zod";

config();

const envSchema = z.object({
	BASE_URL: z.string().url(),
	PORT: z.coerce.number().default(3000),
	REDIS_HOST: z.string().min(1),
	REDIS_PORT: z.string().min(1),
	REDIS_PASSWORD: z.string().min(1),
	GEMINI_API_KEY: z.string().min(1),
	GCS_ASSETS_BUCKET: z.string().min(1),
	GOOGLE_APPLICATION_CREDENTIALS: z.string().min(1),
	GOOGLE_CLIENT_ID: z.string().min(1),
	GOOGLE_CLIENT_SECRET: z.string().min(1),
	DEBUG_LOG_MEDIA: z
		.string()
		.transform((val) => val.toLowerCase() === "true")
		.default("false"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
	console.error("❌ Invalid environment variables:", parsed.error.format());
	throw new Error("Invalid environment variables");
}

export const ENV_CONFIG = parsed.data;

export type EnvConfig = z.infer<typeof envSchema>;
