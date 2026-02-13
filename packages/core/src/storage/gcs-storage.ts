import path from "node:path";
import { Storage } from "@google-cloud/storage";
import type { StorageService } from "./interface.js";

export class GCSStorageService implements StorageService {
	private storage: Storage;
	private assetsBucketName: string;

	constructor(config: {
		googleApplicationCredentialsPath?: string;
		googleClientId: string;
		gcsAssetsBucket: string;
	}) {
		const credentialsPath = config.googleApplicationCredentialsPath
			? path.join(config.googleApplicationCredentialsPath)
			: undefined;

		this.assetsBucketName = config.gcsAssetsBucket;

		// Note: Dynamic import for credentials JSON might need careful handling
		// if this code runs in environment where that file doesn't exist at build time.
		// For now, we assume standard GCS initialization.

		const storageOptions: any = {
			projectId: config.googleClientId,
		};

		if (credentialsPath) {
			storageOptions.keyFilename = credentialsPath;
		}

		this.storage = new Storage(storageOptions);
	}

	async uploadToStorage(
		buffer: Buffer,
		key: string,
		contentType: string,
		bucketName: string,
	): Promise<void> {
		const bucket = this.storage.bucket(bucketName);
		const file = bucket.file(key);

		await file.save(buffer, {
			contentType: contentType,
			resumable: false,
		});
	}

	async deleteFromStorage(key: string, bucketName: string): Promise<void> {
		await this.storage.bucket(bucketName).file(key).delete();
	}

	async generateSignedUrl(
		key: string,
		bucketName: string,
		expiresIn: number = 3600,
	): Promise<string> {
		const options = {
			version: "v4" as const,
			action: "read" as const,
			expires: Date.now() + expiresIn * 1000,
		};

		const [url] = await this.storage
			.bucket(bucketName)
			.file(key)
			.getSignedUrl(options);

		return url;
	}

	async getFromStorage(
		key: string,
		bucketName: string = this.assetsBucketName,
	): Promise<Buffer> {
		const [content] = await this.storage
			.bucket(bucketName)
			.file(key)
			.download();
		return content;
	}

	async getObjectMetadata(
		key: string,
		bucketName: string = this.assetsBucketName,
	) {
		const [metadata] = await this.storage
			.bucket(bucketName)
			.file(key)
			.getMetadata();
		return metadata;
	}

	async listFromStorage(prefix: string, bucketName: string): Promise<string[]> {
		const [files] = await this.storage.bucket(bucketName).getFiles({
			prefix: prefix,
		});

		return files.map((file) => file.name);
	}

	// Kept as-is logic from original
	async uploadToTemporaryStorageFolder(buffer: Buffer, mimeType: string, key: string) {
		const keyToUse = `temp/${key}`;
		await this.uploadToStorage(buffer, keyToUse, mimeType, this.assetsBucketName);
		const expiresIn = 3600 * 24 * 1.9; // A bit less than 2 days
		const signedUrl = await this.generateSignedUrl(
			keyToUse,
			this.assetsBucketName,
			expiresIn,
		);
		return { signedUrl, key: keyToUse };
	}

	// Helper specific to Node streams, might be needed by Hono
	getStreamFromStorage(
		key: string,
		bucketName: string,
		range?: { start: number; end: number },
	) {
		const file = this.storage.bucket(bucketName).file(key);
		const options = range ? { start: range.start, end: range.end } : {};
		return file.createReadStream(options);
	}

	async fileExistsInStorage(key: string, bucketName: string): Promise<boolean> {
		try {
			const [exists] = await this.storage.bucket(bucketName).file(key).exists();
			return exists;
		} catch (error) {
			console.warn(
				`Failed to check existence for ${key} in ${bucketName}`,
				error,
			);
			return false;
		}
	}
}
