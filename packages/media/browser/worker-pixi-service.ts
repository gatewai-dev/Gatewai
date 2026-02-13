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
} from "@pixi/webworker";
import { BasePixiService } from "../common/index.js";

export class WorkerPixiService extends BasePixiService {
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
		return await Assets.load({
			src: url,
			loadParser: "loadTextures",
		});
	}

	protected getPixiImport(): string {
		return "@pixi/webworker";
	}

	protected async getPixiModules() {
		return {
			Filter,
			Sprite,
			Container,
			Graphics,
			BlurFilter,
			Texture,
			Rectangle,
		};
	}

	protected async extractBlob(
		renderer: IRenderer,
		target: Container,
	): Promise<Blob> {
		try {
			const canvas = renderer.extract.canvas(target) as OffscreenCanvas;
			return await canvas.convertToBlob({ type: "image/png" });
		} catch (_e) {
			const pixels = renderer.extract.pixels(target);
			const canvas = new OffscreenCanvas(renderer.width, renderer.height);
			const ctx = canvas.getContext("2d");
			if (!ctx) {
				throw new Error("2d Canvas context is not supported");
			}
			const imageData = new ImageData(
				new Uint8ClampedArray(pixels.buffer),
				renderer.width,
				renderer.height,
			);
			ctx.putImageData(imageData, 0, 0);

			const blob = await canvas.convertToBlob();
			return blob;
		}
	}
}

export const pixiWorkerService = new WorkerPixiService();
