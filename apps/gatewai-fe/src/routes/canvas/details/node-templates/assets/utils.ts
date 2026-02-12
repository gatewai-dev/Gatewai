import { MIME_TYPES } from "@gatewai/core/types";
import qs from "query-string";
import { BASE_URL } from "@gatewai/core/browser";
import type { FileAssetEntity } from "./types";

export function GetAssetThumbnailEndpoint(
	fileAsset: FileAssetEntity,
	size: { width: number; height: number } = { width: 128, height: 128 },
): string {
	// Ensure the ID itself doesn't already have an extension
	const cleanId = fileAsset.id.split(".")[0];
	const sizeQstr = qs.stringify(size);
	const baseUrl = `${BASE_URL}/api/v1/assets/thumbnail/${cleanId}?${sizeQstr}`;

	if (!fileAsset.mimeType) return baseUrl;

	const extension = Object.entries(MIME_TYPES).find(
		([_, mime]) => mime === fileAsset.mimeType,
	)?.[0];

	// Remotion needs this extension to trigger the correct 'bunny'
	return extension ? `${baseUrl}.${extension}` : baseUrl;
}
