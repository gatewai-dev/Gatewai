import { MIME_TYPES, type FileData } from "@gatewai/core/types";
import type { FileAsset } from "@gatewai/db";

import { getEnv } from "./env";

export const BASE_URL = getEnv("VITE_BASE_URL");

/**
 * Appends a file extension hint to the URL.
 * Remotion's MediaBunny requires an extension in the URL string
 * to identify the container format before fetching.
 */
function GetAssetEndpoint(fileAsset: FileAsset) {
	// Ensure the ID itself doesn't already have an extension
	const cleanId = fileAsset.id.split(".")[0];
	const baseUrl = `${BASE_URL}/api/v1/assets/${cleanId}`;
	if (!fileAsset.mimeType) return baseUrl;

	const extension = Object.entries(MIME_TYPES).find(
		([_, mime]) => mime === fileAsset.mimeType,
	)?.[0];

	// Remotion needs this extension to trigger the correct 'bunny'
	return extension ? `${baseUrl}.${extension}` : baseUrl;
}

function GetFontAssetUrl(name: string) {
	return `${BASE_URL}/api/v1/fonts/load/${name}`;
}

const extractExtension = (url: string): string | null => {
	try {
		// Handle data URLs
		if (url.startsWith("data:")) {
			const match = url.match(/data:([^;]+)/);
			if (match) {
				const mimeType = match[1];
				// Find extension from MIME type
				const entry = Object.entries(MIME_TYPES).find(
					([_, mime]) => mime === mimeType,
				);
				return entry?.[0] || null;
			}
		}

		// Handle regular URLs
		const urlObj = new URL(url);
		const pathname = urlObj.pathname;
		const match = pathname.match(/\.([a-zA-Z0-9]+)$/);
		return match?.[1] || null;
	} catch {
		return null;
	}
};

/**
 * Maps a MIME type string to a DataType value.
 * Falls back to "Text" or undefined if no match is found.
 */
export function getDataTypeFromMime(mimeType: string) {
	if (!mimeType) return null;
	if (mimeType.startsWith("image/")) {
		return "Image";
	}
	if (mimeType.startsWith("video/")) {
		return "Video";
	}
	if (mimeType.startsWith("audio/")) {
		return "Audio";
	}

	return null;
}

const isFileData = (data: unknown): data is FileData => {
	return (
		typeof data === "object" &&
		data !== null &&
		("processData" in data || "entity" in data)
	);
};

export function ResolveFileDataUrl(data: FileData) {
	if (!data) return null;
	if (data.processData?.dataUrl) return data.processData.dataUrl;
	if (data.entity?.signedUrl) return GetAssetEndpoint(data.entity);
}

export { GetAssetEndpoint, GetFontAssetUrl, extractExtension, isFileData };
