import type { DataType, FileAsset } from "@gatewai/db";
import type { FileData } from "@gatewai/types";

function GetDataTypeFromMimetype(mimeType: string): DataType {
	if (mimeType.startsWith("audio/")) {
		return "Audio";
	} else if (mimeType.startsWith("video/")) {
		return "Video";
	} else if (mimeType.startsWith("image/")) {
		return "Image";
	} else {
		return "File";
	}
}

export const DATA_TYPE_EXTENSIONS: Record<DataType, string> = {
	Image: "png",
	Video: "mp4",
	Audio: "mp3",
	File: "bin",
	Mask: "png",
	Text: "txt",
	Number: "txt",
	Boolean: "txt",
};

const BACKEND_URL = import.meta.env.VITE_BASE_URL;

function GetAssetEndpoint(id: FileAsset["id"]) {
	return `${BACKEND_URL}/api/v1/assets/${id}`;
}

function GetFontAssetUrl(name: string) {
	return `${BACKEND_URL}/api/v1/fonts/load/${name}`;
}

// MIME type mapping
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

const isFileData = (data: unknown): data is FileData => {
	return (
		typeof data === "object" &&
		data !== null &&
		("processData" in data || "entity" in data)
	);
};

export {
	GetDataTypeFromMimetype,
	GetAssetEndpoint,
	GetFontAssetUrl,
	extractExtension,
	isFileData,
};
