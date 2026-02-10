import type { Readable } from "node:stream";
import { BasePixiService } from "@gatewai/pixi-processor";
import type { FileData, IPixiProcessor, MediaService } from "@gatewai/types";
import {
	Application,
	Assets,
	BlurFilter,
	Container,
	Filter,
	Graphics,
	Rectangle,
	Sprite,
	Texture,
} from "@pixi/node";
import { createCanvas, ImageData } from "canvas";
import sharp from "sharp";

// 1. Polyfill ImageData
if (typeof global.ImageData === "undefined") {
	// biome-ignore lint/suspicious/noExplicitAny: No-need
	(global as any).ImageData = ImageData;
}

// 2. Polyfill the document factory for Pixi's extract utility
if (typeof global.document === "undefined") {
	// biome-ignore lint/suspicious/noExplicitAny: No-need
	(global as any).document = {
		createElement: (type: string) => {
			if (type === "canvas") return createCanvas(1, 1);
			return {};
		},
	};
}

class BackendPixiService extends BasePixiService implements IPixiProcessor {
	private initialized = false;

	protected createApplication(): Application {
		return new Application({
			width: 1,
			height: 1,
			backgroundAlpha: 0,
			antialias: true,
		});
	}

	protected async loadTexture(url: string, apiKey?: string): Promise<Texture> {
		if (!this.initialized) {
			await Assets.init();
			this.initialized = true;
		}

		// Prepare headers with API key for authentication
		const headers: HeadersInit = {};
		if (apiKey) {
			headers["X-API-KEY"] = apiKey;
		}

		// Fetch the image with authentication
		const imageResp = await fetch(url, { headers });

		if (!imageResp.ok) {
			throw new Error(
				`Failed to load texture from ${url}: ${imageResp.status} ${imageResp.statusText}`,
			);
		}

		const arrayBuffer = await imageResp.arrayBuffer();
		const buffer = Buffer.from(arrayBuffer);

		// Use sharp to decode to raw RGBA pixels (works for all image formats)
		const { data, info } = await sharp(buffer)
			.ensureAlpha() // Ensure RGBA (adds alpha channel if missing)
			.raw()
			.toBuffer({ resolveWithObject: true });

		// Create Pixi Texture from raw buffer
		const rgbaData = new Uint8Array(data.buffer, data.byteOffset, data.length);
		return Texture.fromBuffer(rgbaData, info.width, info.height);
	}

	/**
	 * Override to provide statically imported Pixi modules
	 */
	protected async getPixiModules() {
		return {
			Filter,
			Sprite,
			Container,
			Graphics,
			BlurFilter,
			Rectangle,
			Texture,
		};
	}

	protected getPixiImport(): string {
		return "@pixi/node";
	}

	// @ts-expect-error - The types from pixi-types-stub might conflict slightly with @pixi/node but implementation is correct
	protected async extractBlob(renderer: any, target: Container): Promise<Blob> {
		const bounds = target.getBounds();
		const width = Math.floor(bounds.width);
		const height = Math.floor(bounds.height);

		// Extract raw RGBA pixel data
		const pixelData = renderer.extract.pixels(target);

		// Use sharp to encode raw RGBA pixels to PNG
		const buffer = await sharp(Buffer.from(pixelData.buffer), {
			raw: {
				width,
				height,
				channels: 4, // RGBA
			},
		})
			.png()
			.toBuffer();

		return new Blob([buffer], { type: "image/png" });
	}
}

export class ServerMediaService implements MediaService {
	public backendPixiService: IPixiProcessor;
	private baseUrl: string;

	constructor(baseUrl: string) {
		this.backendPixiService = new BackendPixiService();
		this.baseUrl = baseUrl;
	}

	async getImageDimensions(
		buffer: Buffer,
	): Promise<{ width: number; height: number }> {
		const metadata = await sharp(buffer).metadata();
		return { width: metadata.width || 0, height: metadata.height || 0 };
	}

	async getImageBuffer(imageInput: FileData): Promise<Buffer> {
		const urlToUse =
			imageInput.processData?.dataUrl ?? imageInput.entity?.signedUrl;

		if (!urlToUse) {
			throw new Error("No URL found in FileData");
		}

		const response = await fetch(urlToUse);
		return Buffer.from(await response.arrayBuffer());
	}

	bufferToDataUrl(buffer: Buffer, mimeType: string): string {
		return `data:${mimeType};base64,${buffer.toString("base64")}`;
	}

	resolveFileDataUrl(data: FileData | null): string | null {
		if (!data) return null;
		if (data.processData?.dataUrl) {
			// Logic ported from backend/src/utils/misc.ts GetProcessDataEndpoint
			const tempKey = data.processData.tempKey;
			if (!tempKey) return null; // Or handle as error

			const baseUrl = this.baseUrl.endsWith("/")
				? this.baseUrl.slice(0, -1)
				: this.baseUrl;

			const path = tempKey.startsWith("/") ? tempKey.slice(1) : tempKey;

			return `${baseUrl}/api/v1/assets/temp/${path}`;
		}

		if (data.entity?.signedUrl) {
			// Logic ported from backend/src/utils/misc.ts GetAssetEndpoint
			const fileAsset = data.entity;
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

			const cleanId = fileAsset.id.split(".")[0];
			const baseUrl = `${this.baseUrl}/api/v1/assets/${cleanId}`;

			if (!fileAsset.mimeType) return baseUrl;

			const extension = Object.entries(MIME_TYPES).find(
				([_, mime]) => mime === fileAsset.mimeType,
			)?.[0];
			// Remotion needs this extension to trigger the correct 'bunny'
			return extension ? `${baseUrl}.${extension}` : baseUrl;
		}

		return null;
	}
}
