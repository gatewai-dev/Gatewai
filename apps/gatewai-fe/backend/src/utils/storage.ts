import path from "node:path";
import { Readable } from "node:stream";
import { Storage } from "@google-cloud/storage";
import { ENV_CONFIG } from "@gatewai/core";

const CREDENTIALS_PATH = path.join(
	ENV_CONFIG.GOOGLE_APPLICATION_CREDENTIALS_PATH ?? "",
);

export const storage = new Storage({
	credentials: ENV_CONFIG.GOOGLE_APPLICATION_CREDENTIALS_PATH
		? (await import(CREDENTIALS_PATH, { with: { type: "json" } })).default
		: undefined,
	projectId: ENV_CONFIG.GOOGLE_CLIENT_ID,
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
	bucketName: string = ENV_CONFIG.GCS_ASSETS_BUCKET,
): Promise<Buffer> {
	const [content] = await storage.bucket(bucketName).file(key).download();

	return content;
}

export async function getObjectMetadata(
	key: string,
	bucketName: string = ENV_CONFIG.GCS_ASSETS_BUCKET,
) {
	const [metadata] = await storage.bucket(bucketName).file(key).getMetadata();

	return metadata;
}

export async function listFromGCS(
	prefix: string,
	bucketName: string,
): Promise<string[]> {
	const [files] = await storage.bucket(bucketName).getFiles({
		prefix: prefix,
	});

	return files.map((file) => file.name);
}

export function getStreamFromGCS(
	key: string,
	bucketName: string,
	range?: { start: number; end: number },
) {
	const file = storage.bucket(bucketName).file(key);
	const options = range ? { start: range.start, end: range.end } : {};

	// Create the Node.js stream
	const nodeStream = file.createReadStream(options);

	// Convert Node.js stream to Web ReadableStream for Hono
	return Readable.toWeb(nodeStream) as ReadableStream;
}

/**
 * Checks if a file exists in the specified GCS bucket.
 */
export async function fileExistsInGCS(
	key: string,
	bucketName: string,
): Promise<boolean> {
	try {
		const [exists] = await storage.bucket(bucketName).file(key).exists();
		return exists;
	} catch (error) {
		console.warn(
			`Failed to check existence for ${key} in ${bucketName}`,
			error,
		);
		return false;
	}
}

/**
 * Uploads a file to temporary folder of assets bucket.
 * @param buffer File buffer
 * @param mimeType Mime type of the file
 * @param key The key after /temp prefix -> temp/${key}
 */
export async function uploadToTemporaryFolder(
	buffer: Buffer,
	mimeType: string,
	key: string,
) {
	const keyToUse = `temp/${key}`;
	await uploadToGCS(buffer, keyToUse, mimeType, ENV_CONFIG.GCS_ASSETS_BUCKET);
	const expiresIn = 3600 * 24 * 1.9; // A bit less than 2 days
	const signedUrl = await generateSignedUrl(
		keyToUse,
		ENV_CONFIG.GCS_ASSETS_BUCKET,
		expiresIn,
	);
	return { signedUrl, key: keyToUse };
}
