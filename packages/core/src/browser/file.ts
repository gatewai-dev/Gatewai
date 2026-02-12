import { MIME_TYPES, type FileData } from "../types/index.js";
import type { FileAsset } from "@gatewai/db";
import { getEnv } from "./env.js";

export const BASE_URL = getEnv("VITE_BASE_URL") as string;

/**
 * Appends a file extension hint to the URL.
 */
export function GetAssetEndpoint(fileAsset: FileAsset) {
    const cleanId = fileAsset.id.split(".")[0];
    const baseUrl = `${BASE_URL}/api/v1/assets/${cleanId}`;
    if (!fileAsset.mimeType) return baseUrl;

    const extension = Object.entries(MIME_TYPES).find(
        ([_, mime]) => mime === fileAsset.mimeType,
    )?.[0];

    return extension ? `${baseUrl}.${extension}` : baseUrl;
}

export function GetFontAssetUrl(name: string) {
    return `${BASE_URL}/api/v1/fonts/load/${name}`;
}

export const extractExtension = (url: string): string | null => {
    try {
        if (url.startsWith("data:")) {
            const match = url.match(/data:([^;]+)/);
            if (match) {
                const mimeType = match[1];
                const entry = Object.entries(MIME_TYPES).find(
                    ([_, mime]) => mime === mimeType,
                );
                return entry?.[0] || null;
            }
        }

        const urlObj = new URL(url);
        const pathname = urlObj.pathname;
        const match = pathname.match(/\.([a-zA-Z0-9]+)$/);
        return match?.[1] || null;
    } catch {
        return null;
    }
};

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

export const isFileData = (data: unknown): data is FileData => {
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
    return null;
}
