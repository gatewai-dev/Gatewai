/**
 * Interface for storage operations.
 */
export interface StorageService {
	uploadToTemporaryStorageFolder: (
		buffer: Buffer,
		mimeType: string,
		key: string,
	) => Promise<{ signedUrl: string; key: string }>;

	uploadToStorage: (
		buffer: Buffer,
		key: string,
		contentType: string,
		bucketName: string,
	) => Promise<void>;

	generateSignedUrl: (
		key: string,
		bucketName: string,
		expiresIn?: number,
	) => Promise<string>;

	getFromStorage: (key: string, bucket?: string) => Promise<Buffer>;

	getObjectMetadata: (key: string, bucket?: string) => Promise<any>;

	deleteFromStorage: (key: string, bucketName: string) => Promise<void>;

	fileExistsInStorage: (key: string, bucketName: string) => Promise<boolean>;

	getStreamFromStorage: (
		key: string,
		bucketName: string,
		range?: { start: number; end: number },
	) => NodeJS.ReadableStream;
}
