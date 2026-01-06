import path from "node:path";
import { fileURLToPath } from "node:url";
import { Storage } from "@google-cloud/storage";
import { ENV_CONFIG } from "../config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CREDENTIALS_PATH = path.join(
	__dirname,
	"..",
	"..",
	"..",
	ENV_CONFIG.GOOGLE_APPLICATION_CREDENTIALS,
);

const storage = new Storage({
	keyFile: CREDENTIALS_PATH,
	projectId: process.env.GCP_PROJECT_ID,
});

export async function uploadToGCS(
	buffer: Buffer,
	key: string,
	contentType: string,
	bucketName: string,
): Promise<void> {
	const bucket = storage.bucket(bucketName);
	const file = bucket.file(key);

	await file.save(buffer, {
		contentType: contentType,
		resumable: false,
	});
}

export async function deleteFromGCS(
	key: string,
	bucketName: string,
): Promise<void> {
	await storage.bucket(bucketName).file(key).delete();
}

export async function generateSignedUrl(
	key: string,
	bucketName: string,
	expiresIn: number = 3600,
): Promise<string> {
	const options = {
		version: "v4" as const,
		action: "read" as const,
		expires: Date.now() + expiresIn * 1000,
	};

	const [url] = await storage
		.bucket(bucketName)
		.file(key)
		.getSignedUrl(options);

	return url;
}

export async function getFromGCS(
	key: string,
	bucketName: string,
): Promise<Buffer> {
	const [content] = await storage.bucket(bucketName).file(key).download();

	return content;
}
