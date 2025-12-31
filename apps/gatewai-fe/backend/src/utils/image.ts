import type { FileData, ModulateNodeConfig } from "@gatewai/types";
import sharp from "sharp";

export async function getImageBuffer(imageInput: FileData): Promise<Buffer> {
	if (imageInput.dataUrl) {
		const base64 = imageInput.dataUrl.split(";base64,").pop() ?? "";
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
	if (imageInput.dataUrl) {
		const match = imageInput.dataUrl.match(/^data:(image\/[^;]+);base64,/);
		if (match?.[1]) {
			return match?.[1];
		}
	}
	throw new Error("Could not determine mime type");
}

export function bufferToDataUrl(buffer: Buffer, mimeType: string): string {
	return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

export async function applyBlur(
	buffer: Buffer,
	blurAmount: number,
): Promise<Buffer> {
	if (blurAmount <= 0) return buffer;
	return sharp(buffer).blur(blurAmount).toBuffer();
}

export async function applyModulate(
	buffer: Buffer,
	config: ModulateNodeConfig,
): Promise<Buffer> {
	const {
		hue = 0, // -180 to 180 degrees
		saturation = 0, // -1 to 1
		lightness = 0, // -1 to 1
		brightness = 0,
	} = config;

	let pipeline = sharp(buffer);

	// Apply Modulate adjustments using modulate
	if (hue !== 0 || saturation !== 0 || lightness !== 0) {
		pipeline = pipeline.modulate({
			hue: hue, // -180 to 180 degrees
			saturation: 1 + saturation, // convert -1..1 to 0..2 multiplier
			lightness: 1 + lightness, // convert -1..1 to 0..2 multiplier
			brightness: 1 + brightness,
		});
	}

	return pipeline.toBuffer();
}

export const applyCrop = async (
	buffer: Buffer,
	leftPct: number,
	topPct: number,
	widthPct: number,
	heightPct: number,
): Promise<Buffer> => {
	const image = sharp(buffer);
	const metadata = await image.metadata();
	if (!metadata.width || !metadata.height) {
		throw new Error("Invalid image metadata");
	}
	const left = Math.floor((leftPct / 100) * metadata.width);
	const top = Math.floor((topPct / 100) * metadata.height);
	const cropWidth = Math.floor((widthPct / 100) * metadata.width);
	const cropHeight = Math.floor((heightPct / 100) * metadata.height);

	// Ensure crop dimensions are positive and within bounds
	if (
		cropWidth <= 0 ||
		cropHeight <= 0 ||
		left < 0 ||
		top < 0 ||
		left + cropWidth > metadata.width ||
		top + cropHeight > metadata.height
	) {
		throw new Error("Invalid crop parameters");
	}

	return image
		.extract({ left, top, width: cropWidth, height: cropHeight })
		.toBuffer();
};

export async function applyResize(
	buffer: Buffer,
	width: number,
	height: number,
): Promise<Buffer> {
	if (width <= 0 && height <= 0) return buffer;
	return sharp(buffer).resize(width, height).toBuffer();
}

export async function getImageDimensions(
	buffer: Buffer,
): Promise<{ width: number; height: number }> {
	const metadata = await sharp(buffer).metadata();
	return { width: metadata.width, height: metadata.height };
}
