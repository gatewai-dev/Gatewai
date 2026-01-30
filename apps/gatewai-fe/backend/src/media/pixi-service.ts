import { BasePixiService } from "@gatewai/pixi-processor";
import {
	Application,
	Assets,
	BlurFilter,
	Container,
	Filter,
	Graphics,
	type IRenderer,
	Rectangle,
	Sprite,
	Texture,
} from "@pixi/node";
import { createCanvas, ImageData } from "canvas"; // Removed unused Image import
import sharp from "sharp";
import { ENV_CONFIG } from "../config.js";

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

export class BackendPixiService extends BasePixiService {
	private initialized = false;

	protected createApplication(): Application {
		return new Application({
			width: 1,
			height: 1,
			backgroundAlpha: 0,
			antialias: true,
		});
	}

	protected async loadTexture(url: string): Promise<Texture> {
		if (!this.initialized) {
			await Assets.init();
			this.initialized = true;
		}

		// Prepare headers with API key for authentication
		const headers: HeadersInit = {};
		if (ENV_CONFIG.GATEWAI_API_KEY) {
			headers["X-API-KEY"] = ENV_CONFIG.GATEWAI_API_KEY;
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

	/**
	 * Extract as Blob directly (more efficient)
	 */
	protected async extractBlob(
		renderer: IRenderer,
		target: Container,
	): Promise<Blob> {
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

export const backendPixiService = new BackendPixiService();
