import assert from "node:assert";
import type { FileData } from "@gatewai/types";
import sharp from "sharp";
import { resolveMimeTypeFromDataUrl } from "./file-utils.js";

export async function getImageBuffer(imageInput: FileData): Promise<Buffer> {
	const urlToUse =
		imageInput.processData?.dataUrl ?? imageInput.entity?.signedUrl;
	assert(urlToUse);
	const response = await fetch(urlToUse);
	return Buffer.from(await response.arrayBuffer());
}

export function getMimeType(imageInput: FileData): string | undefined {
	if (imageInput.entity?.mimeType) return imageInput.entity.mimeType;
	if (imageInput.processData?.dataUrl) {
		return resolveMimeTypeFromDataUrl(imageInput.processData?.dataUrl);
	}
	throw new Error("Could not determine mime type");
}

export function bufferToDataUrl(buffer: Buffer, mimeType: string): string {
	return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

export async function getImageDimensions(
	buffer: Buffer,
): Promise<{ width: number; height: number }> {
	const metadata = await sharp(buffer).metadata();
	return { width: metadata.width, height: metadata.height };
}
