import { GetAssetEndpointBackend } from "@gatewai/core";
import type {
	FileData,
	IPixiProcessor,
	MediaService,
} from "@gatewai/core/types";
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
import { BasePixiService } from "../shared/pixi/base-pixi-service.js";

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
		const headers: Record<string, string> = {};
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
			(imageInput.processData?.dataUrl ?? imageInput?.entity)
				? GetAssetEndpointBackend(this.baseUrl, imageInput.entity)
				: null;

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
			const tempKey = data.processData.tempKey;
			if (!tempKey) return null;

			const baseUrl = this.baseUrl.endsWith("/")
				? this.baseUrl.slice(0, -1)
				: this.baseUrl;

			const path = tempKey.startsWith("/") ? tempKey.slice(1) : tempKey;

			return `${baseUrl}/api/v1/assets/temp/${path}`;
		}

		if (data.entity) {
			const fileAsset = data.entity;
			return GetAssetEndpointBackend(this.baseUrl, fileAsset);
		}

		return null;
	}
}
