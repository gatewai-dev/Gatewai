import type { FileData, ModulateNodeConfig } from "@gatewai/types";
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
		hue = 0, // Now 0 to 360 (or -180 to 180)
		saturation = 1, // Now 0 to 2 multiplier
		lightness = 1, // Now 0 to 2 multiplier
		brightness = 1, // Now 0 to 2 multiplier
	} = config;

	let pipeline = sharp(buffer);

	// Identity check: sharp's modulate identity is hue:0, others:1
	if (hue !== 0 || saturation !== 1 || lightness !== 1 || brightness !== 1) {
		pipeline = pipeline.modulate({
			hue: hue,
			saturation: saturation,
			brightness: brightness,
			// Note: Sharp's 'lightness' in .modulate() is actually an
			// additive L* offset in Lab space, not a multiplier.
			// To match our Oklab filter's multiplicative logic exactly:
			lightness: (lightness - 1) * 100,
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
