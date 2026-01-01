import type { DataType, FileAsset } from "@gatewai/db";

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

const BACKEND_URL = import.meta.env.VITE_BASE_URL;

function GetAssetEndpoint(id: FileAsset["id"]) {
	return `${BACKEND_URL}/api/v1/assets/${id}`;
}

function GetFontAssetUrl(name: string) {
	return `${BACKEND_URL}/api/v1/fonts/load/${name}`;
}

export { GetDataTypeFromMimetype, GetAssetEndpoint, GetFontAssetUrl };
