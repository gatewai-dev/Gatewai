import { BasePixiService } from "@gatewai/pixi-processor";
import {
	Application,
	Assets,
	BlurFilter,
	Container,
	Graphics,
	type IRenderer,
	Sprite,
	type Texture,
} from "pixi.js";

export class FrontendPixiService extends BasePixiService {
	private initialized = false;

	protected createApplication(): Application {
		return new Application({
			width: 800,
			height: 600,
			backgroundAlpha: 0,
			resolution: window.devicePixelRatio || 1,
			hello: true,
		});
	}

	protected async loadTexture(url: string): Promise<Texture> {
		if (!this.initialized) {
			await Assets.init();
			this.initialized = true;
		}
		return await Assets.load(url);
	}

	protected getPixiImport(): string {
		// This won't be used in frontend since we override getPixiModules
		return "pixi.js";
	}

	/**
	 * Override to provide statically imported Pixi modules
	 * This avoids dynamic import issues with Vite
	 */
	protected getPixiModules() {
		return {
			Sprite,
			Container,
			Graphics,
			BlurFilter,
		};
	}

	/**
	 * Extracts Base64 using the browser's native capabilities.
	 */
	protected async extractBase64(
		renderer: IRenderer,
		target: Container,
	): Promise<string> {
		try {
			// Ensure bounds are calculated
			target.getBounds();

			// Use extract.canvas which is more reliable than base64 in v7
			const canvas = renderer.extract.canvas(target);
			return canvas.toDataURL("image/png");
		} catch (e) {
			console.error("Extraction failed:", e);
			throw e;
		}
	}
}

export const pixiProcessor = new FrontendPixiService();
