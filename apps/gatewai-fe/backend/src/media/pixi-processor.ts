import { BasePixiService } from "@gatewai/pixi-processor";
import {
	Application,
	Assets,
	BlurFilter,
	Container,
	Filter,
	Graphics,
	type IRenderer,
	Sprite,
	type Texture,
} from "@pixi/node";
import { createCanvas, ImageData } from "canvas";

// 1. Polyfill ImageData
if (typeof global.ImageData === "undefined") {
	(global as any).ImageData = ImageData;
}

// 2. Polyfill the document factory for Pixi's extract utility
if (typeof global.document === "undefined") {
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
		return await Assets.load(url);
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
		};
	}

	protected getPixiImport(): string {
		return "@pixi/node";
	}

	protected async extractBase64(
		renderer: IRenderer,
		target: Container,
	): Promise<string> {
		// 1. Get raw pixel data (Uint8Array)
		const pixels = renderer.extract.pixels(target);

		// 2. Get the dimensions of the target
		// Note: For a Container, use getLocalBounds() or its stored width/height
		const bounds = target.getLocalBounds();
		const width = Math.ceil(bounds.width);
		const height = Math.ceil(bounds.height);

		if (width === 0 || height === 0) {
			throw new Error(
				"Cannot extract Base64 from a container with 0 width or height",
			);
		}

		// 3. Manually create the canvas and put the image data
		const canvas = createCanvas(width, height);
		const ctx = canvas.getContext("2d");

		// Pixi returns Uint8Array, but ImageData needs Uint8ClampedArray
		const clampedArray = new Uint8ClampedArray(pixels.buffer);
		const imgData = new ImageData(clampedArray, width, height);

		ctx.putImageData(imgData, 0, 0);

		// 4. Return the Base64 string
		return canvas.toDataURL("image/png");
	}
}

export const backendPixiService = new BackendPixiService();
