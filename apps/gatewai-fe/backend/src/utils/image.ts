import type { FileData } from "@gatewai/types";
import sharp from "sharp";

export async function getImageBuffer(imageInput: FileData): Promise<Buffer> {
	if (imageInput.processData?.dataUrl) {
		const base64 =
			imageInput.processData?.dataUrl.split(";base64,").pop() ?? "";
		return Buffer.from(base64, "base64");
	} else if (imageInput.entity?.signedUrl) {
		const response = await fetch(imageInput.entity.signedUrl);
		return Buffer.from(await response.arrayBuffer());
	} else {
		throw new Error("Invalid image input");
	}
}

export function getMimeType(imageInput: FileData): string {
	if (imageInput.entity?.mimeType) return imageInput.entity.mimeType;
	if (imageInput.processData?.dataUrl) {
		const match = imageInput.processData?.dataUrl.match(
			/^data:(image\/[^;]+);base64,/,
		);
		if (match?.[1]) {
			return match?.[1];
		}
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
