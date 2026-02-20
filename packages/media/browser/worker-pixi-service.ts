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
import { BasePixiService } from "../shared/index.js";

export class WorkerPixiService extends BasePixiService {
	/**
	 * Single-flight init promise — prevents the race condition where multiple
	 * concurrent calls each see `initialized === false` and all invoke `Assets.init()`.
	 */
	private initPromise: Promise<void> | null = null;

	private async ensureInitialized(): Promise<void> {
		if (!this.initPromise) {
			this.initPromise = Assets.init().catch((err) => {
				// Allow retry on failure by clearing the cached promise.
				this.initPromise = null;
				throw err;
			});
		}
		return this.initPromise;
	}

	// ─── BasePixiService implementation ──────────────────────────────────────

	protected createApplication(): Application {
		return new Application({
			width: 1,
			height: 1,
			backgroundAlpha: 0,
			antialias: true,
		});
	}

	protected async loadTexture(url: string, _apiKey?: string): Promise<Texture> {
		await this.ensureInitialized();

		// Pixi's default WorkerManager.loadImageBitmap omits credentials, causing
		// 401s for authenticated backend assets. Bypass it with a credentialed fetch.
		if (
			url.includes("/api/v1/assets/") &&
			!url.startsWith("blob:") &&
			!url.startsWith("data:")
		) {
			const response = await fetch(url, { credentials: "include" });
			if (!response.ok) {
				throw new Error(
					`Failed to fetch texture from ${url}: ${response.status} ${response.statusText}`,
				);
			}
			const blob = await response.blob();
			const bitmap = await createImageBitmap(blob);
			const texture = Texture.from(bitmap);

			return texture;
		}

		return Assets.load<Texture>({ src: url, loadParser: "loadTextures" });
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
		// Primary path: delegate to Pixi's extract plugin which handles coordinate
		// mapping and alpha-premultiplication correctly.
		try {
			const canvas = renderer.extract.canvas(target) as OffscreenCanvas;
			return canvas.convertToBlob({ type: "image/png" });
		} catch {
			// Fallback: manual pixel readback. Use target bounds, not renderer
			// dimensions, so we don't return a full-canvas image for sub-region targets.
			const bounds = target.getBounds();
			const width = Math.max(1, Math.floor(bounds.width));
			const height = Math.max(1, Math.floor(bounds.height));

			const pixels = renderer.extract.pixels(target);
			const canvas = new OffscreenCanvas(width, height);
			const ctx = canvas.getContext("2d");
			if (!ctx) throw new Error("OffscreenCanvas 2D context unavailable");

			ctx.putImageData(
				new ImageData(new Uint8ClampedArray(pixels.buffer), width, height),
				0,
				0,
			);

			return canvas.convertToBlob({ type: "image/png" });
		}
	}
}

export const pixiWorkerService = new WorkerPixiService();
