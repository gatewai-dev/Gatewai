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
	Rectangle,
	Sprite,
	Texture,
} from "pixi.js";
import { BuildModulateFilter } from "./filters/modulate";
import type { IPixiProcessor } from "./interface";

export class ServiceAbortError extends Error {
	constructor(message = "Operation cancelled") {
		super(message);
		this.name = "AbortError";
	}
}

export interface PixiResource {
	app: Application;
	id: string;
}

export abstract class BasePixiService implements IPixiProcessor {
	protected pool: Pool<PixiResource>;
	// Limit concurrency to prevent GPU context loss or memory exhaustion
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
				max: 12, // Enough for frontend - may need to parameterize for backend when scaling
				min: 2,
				testOnBorrow: true,
			},
		);
	}

	protected abstract createApplication(): Application;
	protected abstract loadTexture(url: string): Promise<Texture>;
	protected abstract getPixiImport(): string;

	/**
	 * Override this to provide Pixi modules.
	 * Allows separation of concerns between backend (dynamic imports) and frontend (static imports).
	 */
	protected async getPixiModules(): Promise<{
		Sprite: typeof Sprite;
		Container: typeof Container;
		Graphics: typeof Graphics;
		Texture: typeof Texture;
		BlurFilter: typeof BlurFilter;
		Filter: typeof Filter;
		Rectangle: typeof Rectangle;
	}> {
		const pixi = await import(/* @vite-ignore */ this.getPixiImport());
		return {
			Sprite: pixi.Sprite,
			Container: pixi.Container,
			Graphics: pixi.Graphics,
			BlurFilter: pixi.BlurFilter,
			Filter: pixi.Filter,
			Rectangle: pixi.Rectangle,
			Texture: pixi.Texture,
		};
	}

	protected abstract extractBase64(
		renderer: IRenderer,
		target: Container,
	): Promise<string> | string;

	private async createResource(): Promise<PixiResource> {
		const app = this.createApplication();
		return { app, id: Math.random().toString(36).substring(2, 9) };
	}

	private async destroyResource(resource: PixiResource): Promise<void> {
		// Destroying with true ensures context and GL resources are freed
		resource.app.destroy(true, {
			children: true,
			texture: true,
			baseTexture: true,
		});
	}

	private async validateResource(resource: PixiResource): Promise<boolean> {
		// Ensure renderer is still active and context isn't lost
		return !!resource.app.renderer;
	}

	/**
	 * Helper to safely acquire, use, and release a Pixi app.
	 * Handles stage cleanup to prevent memory leaks.
	 */
	protected async useApp<T>(
		fn: (app: Application) => Promise<T>,
		signal?: AbortSignal,
	): Promise<T> {
		return this.limit(async () => {
			this.ensureNotAborted(signal);

			const resource = await this.pool.acquire();
			try {
				// Safety clear before use
				this.cleanupStage(resource.app);
				return await fn(resource.app);
			} finally {
				// Thorough cleanup after use
				this.cleanupStage(resource.app);
				this.pool.release(resource);
			}
		});
	}

	/**
	 * Cleans the stage by removing and destroying children.
	 * Note: We set texture: false to avoid destroying cached textures managed by loadTexture.
	 */
	private cleanupStage(app: Application) {
		const children = app.stage.removeChildren();
		children.forEach((child) => {
			child.destroy({
				children: true,
				texture: false,
				baseTexture: false,
			});
		});
	}

	private ensureNotAborted(signal?: AbortSignal) {
		if (signal?.aborted) {
			throw new ServiceAbortError();
		}
	}

	public async processModulate(
		imageUrl: string,
		config: ModulateNodeConfig,
		signal?: AbortSignal,
	): Promise<{ dataUrl: string; width: number; height: number }> {
		return this.useApp(async (app) => {
			this.ensureNotAborted(signal);

			const texture = await this.loadTexture(imageUrl);
			this.ensureNotAborted(signal);

			const { Sprite, Filter } = await this.getPixiModules();
			const sprite = new Sprite(texture);

			// Strict resizing of the renderer to match image dimensions
			app.renderer.resize(texture.width, texture.height);

			const FilterClass = BuildModulateFilter(Filter);
			const filter = new FilterClass(config);
			sprite.filters = [filter];

			app.stage.addChild(sprite);
			this.ensureNotAborted(signal);

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
			this.ensureNotAborted(signal);

			const texture = await this.loadTexture(imageUrl);
			this.ensureNotAborted(signal);

			const { Sprite, BlurFilter } = await this.getPixiModules();
			const sprite = new Sprite(texture);

			app.renderer.resize(texture.width, texture.height);

			const strength = Math.max(0, options.blurSize);
			// 8 is high quality blur
			const blurFilter = new BlurFilter(strength, 8);
			// Padding ensures blur doesn't get clipped at edges if extract uses bounds
			blurFilter.padding = strength;

			sprite.filters = [blurFilter];
			app.stage.addChild(sprite);

			this.ensureNotAborted(signal);
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
			this.ensureNotAborted(signal);

			const texture = await this.loadTexture(imageUrl);
			this.ensureNotAborted(signal);

			const { Sprite } = await this.getPixiModules();
			const sprite = new Sprite(texture);

			const originalWidth = texture.width;
			const originalHeight = texture.height;

			let targetWidth = options.width;
			let targetHeight = options.height;

			// Logic to preserve aspect ratio if one dimension is missing
			if (!targetWidth && !targetHeight) {
				targetWidth = originalWidth;
				targetHeight = originalHeight;
			} else if (targetWidth && !targetHeight) {
				targetHeight = Math.round(
					originalHeight * (targetWidth / originalWidth),
				);
			} else if (!targetWidth && targetHeight) {
				targetWidth = Math.round(
					originalWidth * (targetHeight / originalHeight),
				);
			}

			if (
				!targetWidth ||
				!targetHeight ||
				targetWidth <= 0 ||
				targetHeight <= 0
			) {
				throw new Error("Invalid resize dimensions calculated");
			}

			sprite.width = targetWidth;
			sprite.height = targetHeight;

			app.renderer.resize(targetWidth, targetHeight);
			app.stage.addChild(sprite);

			this.ensureNotAborted(signal);
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
			this.ensureNotAborted(signal);

			const originalTexture = await this.loadTexture(imageUrl);
			this.ensureNotAborted(signal);

			const { Sprite, Rectangle, Texture } = await this.getPixiModules();

			const origWidth = originalTexture.width;
			const origHeight = originalTexture.height;

			const clamp = (val: number) => Math.max(0, Math.min(100, val));

			const left = (clamp(options.leftPercentage) / 100) * origWidth;
			const top = (clamp(options.topPercentage) / 100) * origHeight;
			const cropWidth = (clamp(options.widthPercentage) / 100) * origWidth;
			const cropHeight = (clamp(options.heightPercentage) / 100) * origHeight;

			const leftPx = Math.floor(left);
			const topPx = Math.floor(top);
			let widthPx = Math.floor(cropWidth);
			let heightPx = Math.floor(cropHeight);

			// Ensure we don't sample outside bounds
			widthPx = Math.max(1, Math.min(widthPx, origWidth - leftPx));
			heightPx = Math.max(1, Math.min(heightPx, origHeight - topPx));

			// Create a new texture with the cropped frame (best practice for efficiency, avoids unnecessary masking)
			const frame = new Rectangle(leftPx, topPx, widthPx, heightPx);
			const croppedTexture = new Texture(originalTexture.baseTexture, frame);

			const sprite = new Sprite(croppedTexture);

			app.renderer.resize(widthPx, heightPx);
			app.stage.addChild(sprite);

			this.ensureNotAborted(signal);
			app.render();

			const dataUrl = await Promise.resolve(
				this.extractBase64(app.renderer, app.stage),
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
			this.ensureNotAborted(signal);

			const { Container, Sprite, Graphics } = await this.getPixiModules();

			let widthToUse: number;
			let heightToUse: number;
			let baseSprite: Sprite | Graphics | undefined;

			// Determine dimensions and background
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

			const container = new Container();

			const spacer = new Graphics();
			spacer.beginFill(0x000000, 0); // Transparent
			spacer.drawRect(0, 0, widthToUse, heightToUse);
			spacer.endFill();
			container.addChild(spacer);

			let maskSprite: Sprite | undefined;
			if (maskUrl) {
				const maskTexture = await this.loadTexture(maskUrl);
				maskSprite = new Sprite(maskTexture);
				maskSprite.width = widthToUse;
				maskSprite.height = heightToUse;
			}

			// 1. Render ONLY Mask
			if (maskSprite) {
				container.addChild(maskSprite);
			}
			app.stage.addChild(container);

			this.ensureNotAborted(signal);
			app.render();

			const onlyMaskDataUrl = await Promise.resolve(
				this.extractBase64(app.renderer, app.stage),
			);

			// 2. Render Image + Mask
			if (baseSprite) {
				// Insert base image *below* the mask (index 1 because spacer is 0)
				container.addChildAt(baseSprite, 1);
			}

			this.ensureNotAborted(signal);
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
