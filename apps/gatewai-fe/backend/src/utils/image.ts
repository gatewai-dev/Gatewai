import assert from "node:assert";
import type { FileData } from "@gatewai/types";
import sharp from "sharp";

export async function getImageBuffer(imageInput: FileData): Promise<Buffer> {
	const urlToUse =
		imageInput.processData?.dataUrl ?? imageInput.entity?.signedUrl;
	assert(urlToUse);
	const response = await fetch(urlToUse);
	return Buffer.from(await response.arrayBuffer());
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
