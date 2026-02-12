import type { FileAsset } from "@gatewai/db";
import { MIME_TYPES } from "../types/index.js";
import type { FileData, ProcessData } from "../types/node-result.js";

export function GetAssetEndpoint(baseUrl: string, fileAsset: FileAsset) {
    // Ensure the ID itself doesn't already have an extension
    const cleanId = fileAsset.id.split(".")[0];
    const assetUrl = `${baseUrl}/api/v1/assets/${cleanId}`;

    if (!fileAsset.mimeType) return assetUrl;

    const extension = Object.entries(MIME_TYPES).find(
        ([_, mime]) => mime === fileAsset.mimeType,
    )?.[0];

    return extension ? `${assetUrl}.${extension}` : assetUrl;
}

export async function GetProcessDataEndpoint(
    baseUrl: string,
    processData: ProcessData,
): Promise<string> {

    const path = processData?.tempKey?.startsWith("/")
        ? processData.tempKey.slice(1)
        : processData.tempKey;

    return `${baseUrl}/api/v1/assets/temp/${path}`;
}

export function ResolveFileDataUrl(baseUrl: string, data: FileData | null) {
    if (!data) return null;
    if (data.processData)
        return GetProcessDataEndpoint(baseUrl, data.processData);
    if (data.entity) return GetAssetEndpoint(baseUrl, data.entity);
}
