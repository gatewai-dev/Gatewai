import type { FileAsset } from "@gatewai/db";
import type { FileData, ProcessData } from "@gatewai/types";
import { customAlphabet } from "nanoid";
import { ENV_CONFIG } from "../config.js";

export function assertIsError(error: unknown): asserts error is Error {
	if (!(error instanceof Error)) {
		throw error;
	}
}

const MIME_TYPES: Record<string, string> = {
	png: "image/png",
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	gif: "image/gif",
	webp: "image/webp",
	svg: "image/svg+xml",
	mp4: "video/mp4",
	webm: "video/webm",
	mov: "video/quicktime",
	mp3: "audio/mpeg",
	wav: "audio/wav",
	ogg: "audio/ogg",
	pdf: "application/pdf",
	json: "application/json",
	txt: "text/plain",
};

export function GetAssetEndpoint(fileAsset: FileAsset) {
	// Ensure the ID itself doesn't already have an extension
	const cleanId = fileAsset.id.split(".")[0];
	const baseUrl = `${ENV_CONFIG.BASE_URL}/api/v1/assets/${cleanId}`;

	if (!fileAsset.mimeType) return baseUrl;

	const extension = Object.entries(MIME_TYPES).find(
		([_, mime]) => mime === fileAsset.mimeType,
	)?.[0];

	// Remotion needs this extension to trigger the correct 'bunny'
	return extension ? `${baseUrl}.${extension}` : baseUrl;
}

export async function GetProcessDataEndpoint(
	processData: ProcessData,
): Promise<string> {
	const baseUrl = ENV_CONFIG.BASE_URL.endsWith("/")
		? ENV_CONFIG.BASE_URL.slice(0, -1)
		: ENV_CONFIG.BASE_URL;

	const path = processData?.tempKey?.startsWith("/")
		? processData.tempKey.slice(1)
		: processData.tempKey;

	return `${baseUrl}/api/v1/assets/temp/${path}`;
}

export function ResolveFileDataUrl(data: FileData | null) {
	if (!data) return null;
	if (data.processData?.dataUrl)
		return GetProcessDataEndpoint(data.processData);
	if (data.entity?.signedUrl) return GetAssetEndpoint(data.entity);
}

// base62 alphabet
const alphabet =
	"0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

// Create a generator for 22-character IDs
const generateId = customAlphabet(alphabet, 22);

export { generateId };
