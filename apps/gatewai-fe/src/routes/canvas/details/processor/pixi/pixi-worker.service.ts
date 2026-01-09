// worker/pixi-worker.service.ts

// IMPORTANT: Import everything from @pixi/webworker instead of pixi.js
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
} from "@pixi/webworker";

export class WorkerPixiService extends BasePixiService {
	private initialized = false;

	protected createApplication(): Application {
		// @pixi/webworker Application is pre-configured for OffscreenCanvas
		return new Application({
			// In a worker, we don't pass a view; it creates an OffscreenCanvas internally
			width: 1,
			height: 1,
			backgroundAlpha: 0,
			antialias: true,
		});
	}

	protected async loadTexture(url: string): Promise<Texture> {
		if (!this.initialized) {
			// Assets.init works out of the box here
			await Assets.init();
			this.initialized = true;
		}
		return await Assets.load(url);
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
		};
	}

	protected async extractBase64(
		renderer: IRenderer,
		target: Container,
	): Promise<string> {
		// v7 CanvasExtract.base64 is async and works with OffscreenCanvas
		// renderer.extract.base64(target) is the standard v7 way
		try {
			return await renderer.extract.base64(target);
		} catch (e) {
			// Fallback for environments where extract.base64 might fail
			const pixels = renderer.extract.pixels(target);
			const canvas = new OffscreenCanvas(renderer.width, renderer.height);
			const ctx = canvas.getContext("2d")!;
			const imageData = new ImageData(
				new Uint8ClampedArray(pixels.buffer),
				renderer.width,
				renderer.height,
			);
			ctx.putImageData(imageData, 0, 0);

			const blob = await canvas.convertToBlob();
			return new Promise((resolve) => {
				const reader = new FileReader();
				reader.onloadend = () => resolve(reader.result as string);
				reader.readAsDataURL(blob);
			});
		}
	}
}

export const pixiWorkerService = new WorkerPixiService();
