import type { ModulateNodeConfig, PaintNodeConfig } from "@gatewai/types";
import { createPool, type Pool } from "generic-pool";
import pLimit from "p-limit";
import type {
	Application,
	BlurFilter,
	Container,
	Filter,
	Graphics,
	IRenderer,
	Sprite,
	Texture,
} from "pixi.js";
import { BuildModualteFilter } from "./filters/modulate";

export interface PixiResource {
	app: Application;
	id: string;
}

export abstract class BasePixiService {
	protected pool: Pool<PixiResource>;
	protected limit = pLimit(12);

	constructor() {
		this.pool = createPool(
			{
				create: async () => this.createResource(),
				destroy: async (resource: PixiResource) =>
					this.destroyResource(resource),
				validate: async (resource: PixiResource) =>
					this.validateResource(resource),
			},
			{
				max: 12,
				min: 2,
				testOnBorrow: true,
			},
		);
	}

	// --- Abstract Methods to be implemented by Frontend/Backend services ---
	protected abstract createApplication(): Application;
	protected abstract loadTexture(url: string): Promise<Texture>;
	protected abstract getPixiImport(): string;

	/**
	 * Override this to provide Pixi modules
	 * Frontend can provide static imports, backend can use dynamic imports
	 */
	protected async getPixiModules(): Promise<{
		Sprite: typeof Sprite;
		Container: typeof Container;
		Graphics: typeof Graphics;
		BlurFilter: typeof BlurFilter;
		Filter: typeof Filter;
	}> {
		// Default implementation uses dynamic import
		const pixi = await import(/* @vite-ignore */ this.getPixiImport());
		return {
			Sprite: pixi.Sprite,
			Container: pixi.Container,
			Graphics: pixi.Graphics,
			BlurFilter: pixi.BlurFilter,
			Filter: pixi.Filter,
		};
	}

	protected abstract extractBase64(
		renderer: IRenderer,
		target: Container,
	): Promise<string> | string;

	// --- Resource Management ---

	private async createResource(): Promise<PixiResource> {
		const app = this.createApplication();
		return { app, id: Math.random().toString(36).substring(2, 9) };
	}

	private async destroyResource(resource: PixiResource): Promise<void> {
		resource.app.destroy(true, {
			children: true,
			texture: true,
			baseTexture: true,
		});
	}

	private async validateResource(resource: PixiResource): Promise<boolean> {
		return !!resource.app.renderer;
	}

	protected async useApp<T>(
		fn: (app: Application) => Promise<T>,
		signal?: AbortSignal,
	): Promise<T> {
		return this.limit(async () => {
			if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");

			const resource = await this.pool.acquire();
			try {
				resource.app.stage.removeChildren();
				return await fn(resource.app);
			} finally {
				resource.app.stage.removeChildren();
				this.pool.release(resource);
			}
		});
	}

	// --- Processors ---

	public async processModulate(
		imageUrl: string,
		config: ModulateNodeConfig,
		signal?: AbortSignal,
	): Promise<{ dataUrl: string; width: number; height: number }> {
		return this.useApp(async (app) => {
			if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");

			const texture = await this.loadTexture(imageUrl);
			if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");

			const { Sprite, Filter } = await this.getPixiModules();
			const sprite = new Sprite(texture);
			app.renderer.resize(sprite.width, sprite.height);
			const FilterClass = BuildModualteFilter(Filter);
			const filter = new FilterClass(config);
			sprite.filters = [filter];

			app.stage.addChild(sprite);
			if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");

			app.render();

			const dataUrl = await Promise.resolve(
				this.extractBase64(app.renderer, app.stage),
			);

			return {
				dataUrl,
				width: app.renderer.width,
				height: app.renderer.height,
			};
		}, signal);
	}

	public async processBlur(
		imageUrl: string,
		options: { blurSize: number },
		signal?: AbortSignal,
	): Promise<{ dataUrl: string; width: number; height: number }> {
		return this.useApp(async (app) => {
			if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");

			const texture = await this.loadTexture(imageUrl);
			if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");

			const { Sprite, BlurFilter } = await this.getPixiModules();
			const sprite = new Sprite(texture);
			app.renderer.resize(sprite.width, sprite.height);

			const strength = Math.max(0, options.blurSize);
			const blurFilter = new BlurFilter(strength, 8);

			sprite.filters = [blurFilter];
			app.stage.addChild(sprite);

			if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
			app.render();

			const dataUrl = await Promise.resolve(
				this.extractBase64(app.renderer, app.stage),
			);

			return {
				dataUrl,
				width: app.renderer.width,
				height: app.renderer.height,
			};
		}, signal);
	}

	public async processResize(
		imageUrl: string,
		options: { width?: number; height?: number },
		signal?: AbortSignal,
	): Promise<{ dataUrl: string; width: number; height: number }> {
		return this.useApp(async (app) => {
			if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");

			const texture = await this.loadTexture(imageUrl);
			if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");

			const { Sprite } = await this.getPixiModules();
			const sprite = new Sprite(texture);

			let targetWidth = texture.width;
			let targetHeight = texture.height;

			if (options.width && options.height) {
				sprite.width = options.width;
				sprite.height = options.height;
				targetWidth = options.width;
				targetHeight = options.height;
				app.renderer.resize(options.width, options.height);
			} else {
				app.renderer.resize(targetWidth, targetHeight);
			}

			app.stage.addChild(sprite);

			if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
			app.render();

			const dataUrl = await Promise.resolve(
				this.extractBase64(app.renderer, app.stage),
			);

			return { dataUrl, width: targetWidth, height: targetHeight };
		}, signal);
	}

	public async processCrop(
		imageUrl: string,
		options: {
			leftPercentage: number;
			topPercentage: number;
			widthPercentage: number;
			heightPercentage: number;
		},
		signal?: AbortSignal,
	): Promise<{ dataUrl: string; width: number; height: number }> {
		return this.useApp(async (app) => {
			if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");

			const texture = await this.loadTexture(imageUrl);
			if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");

			const { Container, Sprite, Graphics } = await this.getPixiModules();

			const origWidth = texture.width;
			const origHeight = texture.height;

			const left = (options.leftPercentage / 100) * origWidth;
			const top = (options.topPercentage / 100) * origHeight;
			const cropWidth = (options.widthPercentage / 100) * origWidth;
			const cropHeight = (options.heightPercentage / 100) * origHeight;

			const leftPx = Math.floor(left);
			const topPx = Math.floor(top);
			const widthPx = Math.floor(cropWidth);
			const heightPx = Math.floor(cropHeight);

			if (widthPx <= 0 || heightPx <= 0)
				throw new Error("Invalid crop parameters");

			const container = new Container();
			const sprite = new Sprite(texture);
			sprite.x = -leftPx;
			sprite.y = -topPx;
			container.addChild(sprite);

			const mask = new Graphics();
			mask.beginFill(0xffffff);
			mask.drawRect(0, 0, widthPx, heightPx);
			mask.endFill();

			container.mask = mask;
			container.addChild(mask);

			app.renderer.resize(widthPx, heightPx);
			app.stage.addChild(container);

			if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
			app.render();

			const dataUrl = await Promise.resolve(
				this.extractBase64(app.renderer, container),
			);

			return { dataUrl, width: widthPx, height: heightPx };
		}, signal);
	}

	public async processMask(
		config: PaintNodeConfig,
		imageUrl: string | undefined,
		maskUrl?: string,
		signal?: AbortSignal,
	): Promise<{
		imageWithMask: { dataUrl: string; width: number; height: number };
		onlyMask: { dataUrl: string; width: number; height: number };
	}> {
		return this.useApp(async (app) => {
			const { backgroundColor } = config;
			if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");

			const { Container, Sprite, Graphics } = await this.getPixiModules();

			let widthToUse: number;
			let heightToUse: number;
			let baseSprite: Sprite | Graphics | undefined;

			if (imageUrl) {
				const texture = await this.loadTexture(imageUrl);
				widthToUse = texture.width;
				heightToUse = texture.height;
				baseSprite = new Sprite(texture);
			} else if (backgroundColor) {
				widthToUse = config.width;
				heightToUse = config.height;
				const graphics = new Graphics();
				graphics.beginFill(backgroundColor);
				graphics.drawRect(0, 0, widthToUse, heightToUse);
				graphics.endFill();
				baseSprite = graphics;
			} else {
				throw new Error("Missing image or background color");
			}

			app.renderer.resize(widthToUse, heightToUse);

			let maskSprite: Sprite | undefined;
			if (maskUrl) {
				const maskTexture = await this.loadTexture(maskUrl);
				maskSprite = new Sprite(maskTexture);
				maskSprite.width = widthToUse;
				maskSprite.height = heightToUse;
			}

			const container = new Container();

			// 1. Render ONLY Mask
			if (maskSprite) container.addChild(maskSprite);
			app.stage.addChild(container);

			if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
			app.render();

			const onlyMaskDataUrl = await Promise.resolve(
				this.extractBase64(app.renderer, app.stage),
			);

			// 2. Render Image + Mask
			if (baseSprite) container.addChildAt(baseSprite, 0);

			if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
			app.render();

			const imageWithMaskDataUrl = await Promise.resolve(
				this.extractBase64(app.renderer, app.stage),
			);

			return {
				imageWithMask: {
					dataUrl: imageWithMaskDataUrl,
					width: widthToUse,
					height: heightToUse,
				},
				onlyMask: {
					dataUrl: onlyMaskDataUrl,
					width: widthToUse,
					height: heightToUse,
				},
			};
		}, signal);
	}
}
