import { config } from "dotenv";
import { z } from "zod";

config();

const envSchema = z.object({
	BASE_URL: z.string().url(),
	PORT: z.coerce.number().default(3000),
	REDIS_HOST: z.string().min(1),
	REDIS_PORT: z.coerce.number(), // Changed to number for easier use with Redis clients
	REDIS_PASSWORD: z.string().optional(),
	GEMINI_API_KEY: z.string().min(1),
	GCS_ASSETS_BUCKET: z.string().min(1),
	GOOGLE_APPLICATION_CREDENTIALS_PATH: z.string().min(1).optional(),
	GOOGLE_CLIENT_ID: z.string().min(1),
	MCP_URL: z.string(),
	GOOGLE_CLIENT_SECRET: z.string().min(1),
	LOG_LEVEL: z.string().default("info"),
	DEBUG_LOG_MEDIA: z
		.string()
		.toLowerCase()
		.transform((val) => val === "true")
		.default("false"),
	DISABLE_EMAIL_SIGNUP: z
		.string()
		.toLowerCase()
		.transform((val) => val === "true")
		.default("false"),
	MAX_CONCURRENT_ASSISTANT_JOBS: z.coerce.number().default(5),
	MAX_CONCURRENT_WORKFLOW_JOBS: z.coerce.number().default(5),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
	console.error("❌ Invalid environment variables:", parsed.error.format());
	throw new Error("Invalid environment variables");
}

export const ENV_CONFIG = parsed.data;

export type EnvConfig = z.infer<typeof envSchema>;
