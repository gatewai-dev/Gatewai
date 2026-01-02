import type {
	CompositorNodeConfig,
	ModulateNodeConfig,
	PaintNodeConfig,
} from "@gatewai/types";
import { createPool, type Pool } from "generic-pool";
import pLimit from "p-limit";
import {
	Application,
	Assets,
	type BLEND_MODES,
	type BlendModeFilter,
	BlurFilter,
	ColorBlend,
	ColorBurnBlend,
	ColorDodgeBlend,
	Container,
	DarkenBlend,
	DifferenceBlend,
	DOMAdapter,
	ExclusionBlend,
	Graphics,
	HardLightBlend,
	LightenBlend,
	LuminosityBlend,
	OverlayBlend,
	SaturationBlend,
	SoftLightBlend,
	Sprite,
	Text,
	TextStyle,
	WebWorkerAdapter,
} from "pixi.js";
import "pixi.js/advanced-blend-modes";
import { fontManager } from "@/lib/fonts";
import { GetFontAssetUrl } from "@/utils/file";
import { ModulateFilter } from "./filters/modulate";

DOMAdapter.set(WebWorkerAdapter);

interface PixiResource {
	app: Application;
	id: string;
}

class PixiProcessorService {
	private pool: Pool<PixiResource>;
	private limit = pLimit(3);

	constructor() {
		this.pool = createPool(
			{
				create: async () => {
					const app = new Application();
					await app.init({
						width: 1024,
						height: 1024,
						autoStart: false,
						backgroundAlpha: 0,
						preference: "webgpu",
						roundPixels: true,
						useBackBuffer: true,
					});
					return { app, id: Math.random().toString(36).substring(2, 9) };
				},
				destroy: async (resource: PixiResource) => {
					resource.app.destroy(true, { children: true, texture: true });
				},
				validate: async (resource: PixiResource) => {
					return !!resource.app.renderer;
				},
			},
			{
				max: 4,
				min: 2, // Keep 1 warm to reduce cold start latency
				testOnBorrow: true,
			},
		);
	}

	private async useApp<T>(
		fn: (app: Application) => Promise<T>,
		signal?: AbortSignal,
	): Promise<T> {
		return this.limit(async () => {
			if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");

			const resource = await this.pool.acquire();
			try {
				// Safety: Ensure the stage is empty before use
				resource.app.stage.removeChildren();
				return await fn(resource.app);
			} finally {
				// Always cleanup and release back to pool
				resource.app.stage.removeChildren();
				this.pool.release(resource);
			}
		});
	}

	/**
	 * Process Modulate adjustments with custom modulate filter
	 */
	public async processModulate(
		imageUrl: string,
		config: ModulateNodeConfig,
		signal?: AbortSignal,
	): Promise<{ dataUrl: string; width: number; height: number }> {
		return this.useApp(async (app) => {
			// Check cancellation before loading
			if (signal?.aborted) {
				throw new DOMException("Operation cancelled", "AbortError");
			}

			// 1. Load the Texture
			const texture = await Assets.load({
				src: imageUrl,
				parser: "texture",
			});

			// Check cancellation after loading
			if (signal?.aborted) {
				throw new DOMException("Operation cancelled", "AbortError");
			}

			// 2. Setup the Scene
			const sprite = new Sprite(texture);

			// Resize the renderer to match the image exactly
			app.renderer.resize(sprite.width, sprite.height);

			// 3. Apply Custom Modulate Filter
			const filter = new ModulateFilter(config);

			sprite.filters = [filter];

			// 4. Render to Stage
			app.stage.addChild(sprite);

			// Check cancellation before rendering
			if (signal?.aborted) {
				throw new DOMException("Operation cancelled", "AbortError");
			}

			app.render();

			// Check cancellation before extraction
			if (signal?.aborted) {
				throw new DOMException("Operation cancelled", "AbortError");
			}

			// 5. Extract Result
			const dataUrl = await app.renderer.extract.base64(app.stage);

			// Final cancellation check
			if (signal?.aborted) {
				throw new DOMException("Operation cancelled", "AbortError");
			}

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
			// Check cancellation before loading
			if (signal?.aborted) {
				throw new DOMException("Operation cancelled", "AbortError");
			}

			// 1. Load the Texture
			const texture = await Assets.load({
				src: imageUrl,
				parser: "texture",
			});

			// Check cancellation after loading
			if (signal?.aborted) {
				throw new DOMException("Operation cancelled", "AbortError");
			}

			// 2. Setup the Scene
			const sprite = new Sprite(texture);

			// Resize the renderer to match the image exactly
			app.renderer.resize(sprite.width, sprite.height);

			// 3. Apply Filter
			const strength = Math.max(0, options.blurSize);

			const blurFilter = new BlurFilter();
			blurFilter.strength = strength;
			blurFilter.quality = 8;

			sprite.filters = [blurFilter];

			// 4. Render to Stage
			app.stage.addChild(sprite);

			// Check cancellation before rendering
			if (signal?.aborted) {
				throw new DOMException("Operation cancelled", "AbortError");
			}

			app.render();

			// Check cancellation before extraction
			if (signal?.aborted) {
				throw new DOMException("Operation cancelled", "AbortError");
			}

			// 5. Extract Result
			const dataUrl = await app.renderer.extract.base64(app.stage);

			// Final cancellation check
			if (signal?.aborted) {
				throw new DOMException("Operation cancelled", "AbortError");
			}

			return {
				dataUrl,
				width: app.renderer.width,
				height: app.renderer.height,
			};
		}, signal);
	}

	/**
	 * Process resize with cancellation support
	 */
	public async processResize(
		imageUrl: string,
		options: { width?: number; height?: number },
		signal?: AbortSignal,
	): Promise<{ dataUrl: string; width: number; height: number }> {
		return this.useApp(async (app) => {
			// Check cancellation before loading
			if (signal?.aborted) {
				throw new DOMException("Operation cancelled", "AbortError");
			}

			// 1. Load the Texture
			const texture = await Assets.load({
				src: imageUrl,
				parser: "texture",
			});

			// Check cancellation after loading
			if (signal?.aborted) {
				throw new DOMException("Operation cancelled", "AbortError");
			}

			// 2. Setup the Scene
			const sprite = new Sprite(texture);

			let targetWidth = texture.width;
			let targetHeight = texture.height;

			if (options.width && options.height) {
				// Set the desired dimensions for the sprite
				sprite.width = options.width;
				sprite.height = options.height;
				targetWidth = options.width;
				targetHeight = options.height;
				// Resize the renderer to match the target dimensions
				app.renderer.resize(options.width, options.height);
			} else {
				app.renderer.resize(targetWidth, targetHeight);
			}

			// 3. Render to Stage
			app.stage.addChild(sprite);

			// Check cancellation before rendering
			if (signal?.aborted) {
				throw new DOMException("Operation cancelled", "AbortError");
			}

			app.render();

			// Check cancellation before extraction
			if (signal?.aborted) {
				throw new DOMException("Operation cancelled", "AbortError");
			}

			// 4. Extract Result
			const dataUrl = await app.renderer.extract.base64(app.stage);

			// Final cancellation check
			if (signal?.aborted) {
				throw new DOMException("Operation cancelled", "AbortError");
			}

			return { dataUrl, width: targetWidth, height: targetHeight };
		}, signal);
	}

	/**
	 * Process crop with cancellation support
	 */
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
			// Check cancellation before loading
			if (signal?.aborted) {
				throw new DOMException("Operation cancelled", "AbortError");
			}

			// 1. Load the Texture
			const texture = await Assets.load({
				src: imageUrl,
				parser: "texture",
			});

			// Check cancellation after loading
			if (signal?.aborted) {
				throw new DOMException("Operation cancelled", "AbortError");
			}

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

			if (
				widthPx <= 0 ||
				heightPx <= 0 ||
				leftPx < 0 ||
				leftPx + widthPx > origWidth ||
				topPx < 0 ||
				topPx + heightPx > origHeight
			) {
				throw new Error("Invalid crop parameters");
			}

			// 2. Setup the Scene with Container
			const container = new Container();
			const sprite = new Sprite(texture);
			sprite.x = -leftPx;
			sprite.y = -topPx;
			container.addChild(sprite);

			// Create a mask for the crop area
			const mask = new Graphics();
			mask.beginFill(0xffffff);
			mask.drawRect(0, 0, widthPx, heightPx);
			mask.endFill();
			container.mask = mask;
			container.addChild(mask);

			// Resize the renderer to match the crop dimensions
			app.renderer.resize(widthPx, heightPx);

			// 3. Render to Stage
			app.stage.addChild(container);

			// Check cancellation before rendering
			if (signal?.aborted) {
				throw new DOMException("Operation cancelled", "AbortError");
			}

			app.render();

			// Check cancellation before extraction
			if (signal?.aborted) {
				throw new DOMException("Operation cancelled", "AbortError");
			}

			// 4. Extract Result - extract the container, not the stage
			const dataUrl = await app.renderer.extract.base64(container);

			// Final cancellation check
			if (signal?.aborted) {
				throw new DOMException("Operation cancelled", "AbortError");
			}

			return { dataUrl, width: widthPx, height: heightPx };
		}, signal);
	}

	/**
	 * Process mask
	 * Returns image with mask overlay and the mask alone
	 */
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

			// Check cancellation before loading
			if (signal?.aborted) {
				throw new DOMException("Operation cancelled", "AbortError");
			}

			// 1. Determine dimensions first
			let widthToUse: number;
			let heightToUse: number;
			let baseSprite: Sprite | Graphics | undefined;

			if (imageUrl) {
				const texture = await Assets.load({
					src: imageUrl,
					parser: "texture",
				});
				if (signal?.aborted) {
					throw new DOMException("Operation cancelled", "AbortError");
				}
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
				throw new Error("Either imageUrl or backgroundColor must be provided");
			}

			// Resize the renderer to match dimensions
			app.renderer.resize(widthToUse, heightToUse);

			// 2. Load the mask texture if provided and scale to dimensions
			let maskSprite: Sprite | undefined;
			if (maskUrl) {
				const maskTexture = await Assets.load({
					src: maskUrl,
					parser: "texture",
				});
				if (signal?.aborted) {
					throw new DOMException("Operation cancelled", "AbortError");
				}
				maskSprite = new Sprite(maskTexture);
				maskSprite.width = widthToUse;
				maskSprite.height = heightToUse;
			}

			// 3. Setup container for rendering
			const container = new Container();

			// First, render and extract ONLY the mask (on transparent background)
			if (maskSprite) {
				container.addChild(maskSprite);
			}

			app.stage.addChild(container);

			// Check cancellation before rendering
			if (signal?.aborted) {
				throw new DOMException("Operation cancelled", "AbortError");
			}

			app.render();

			// Check cancellation before extraction
			if (signal?.aborted) {
				throw new DOMException("Operation cancelled", "AbortError");
			}

			const onlyMaskDataUrl = await app.renderer.extract.base64(app.stage);

			// Check cancellation after extraction
			if (signal?.aborted) {
				throw new DOMException("Operation cancelled", "AbortError");
			}

			// 4. Now add the base sprite behind the mask for imageWithMask
			if (baseSprite) {
				container.addChildAt(baseSprite, 0);
			}

			// Check cancellation before rendering
			if (signal?.aborted) {
				throw new DOMException("Operation cancelled", "AbortError");
			}

			app.render();

			// Check cancellation before extraction
			if (signal?.aborted) {
				throw new DOMException("Operation cancelled", "AbortError");
			}

			const imageWithMaskDataUrl = await app.renderer.extract.base64(app.stage);

			// Final cancellation check
			if (signal?.aborted) {
				throw new DOMException("Operation cancelled", "AbortError");
			}

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

	private forceStageSize(width: number, height: number, app: Application) {
		// Create a transparent spacer that forces the bounds of the stage
		// to match the requested width/height.
		const spacer = new Graphics();
		spacer.beginFill(0x000000, 0); // 0 alpha
		spacer.drawRect(0, 0, width, height);
		spacer.endFill();
		app.stage.addChildAt(spacer, 0);
	}

	public async processCompositor(
		config: CompositorNodeConfig,
		inputs: Record<string, { type: "Image" | "Text"; value: string }>,
		signal?: AbortSignal,
	): Promise<{ dataUrl: string; width: number; height: number }> {
		return this.useApp(async (app) => {
			const width = config.width ?? 1024;
			const height = config.height ?? 1024;
			const assetsToClean: string[] = [];

			app.renderer.resize(width, height);
			this.forceStageSize(width, height, app);

			// Ensure mask matches transparency requirements
			const maskGraphics = new Graphics();
			maskGraphics.rect(0, 0, width, height).fill({ color: 0xffffff });
			app.stage.mask = maskGraphics;
			app.stage.addChild(maskGraphics); // Mask usually needs to be in display list in some versions, but simpler to just assign property

			// 1. Collect all layers, including defaults for inputs without explicit layer configs
			const explicitLayers = Object.values(config.layerUpdates || {});
			const allLayers = [...explicitLayers];

			for (const [handleId, input] of Object.entries(inputs)) {
				if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");

				if (!explicitLayers.some((l) => l.inputHandleId === handleId)) {
					const defaultLayer = {
						id: handleId,
						inputHandleId: handleId,
						type: input.type,
						x: 0,
						y: 0,
						rotation: 0,
						lockAspect: true,
						blendMode: "normal",
						...(input.type === "Text"
							? {
									fontFamily: "Geist",
									fontSize: 24,
									fill: "#fff",
									letterSpacing: 0,
									lineHeight: 1.2,
									align: "left" as const,
								}
							: {}),
					};
					allLayers.push(defaultLayer);
				}
			}

			// 2. Sort layers by zIndex (ascending, with undefined as Infinity/on top)
			const sortedLayers = allLayers.sort((a, b) => {
				const aZ = a.zIndex ?? Infinity;
				const bZ = b.zIndex ?? Infinity;
				return aZ - bZ;
			});

			// 3. Preload Loop
			for (const layer of sortedLayers) {
				if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");
				if (!layer.inputHandleId || !inputs[layer.inputHandleId]) continue;

				const inputData = inputs[layer.inputHandleId];

				if (layer.type === "Text" && layer.fontFamily) {
					const fontUrl = GetFontAssetUrl(layer.fontFamily);
					await fontManager.loadFont(layer.fontFamily, fontUrl);
				} else if (inputData.type === "Image") {
					// We strictly load what is needed for the layers
					await Assets.load({
						alias: `img_${layer.inputHandleId}`,
						src: inputData.value,
						parser: "texture",
					});
					assetsToClean.push(inputData.value);
				}
			}

			// 4. Render Loop (in sorted order: lower zIndex first)
			for (const layer of sortedLayers) {
				if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");

				const inputHandleId = layer.inputHandleId;
				if (!inputHandleId || !inputs[inputHandleId]) continue;

				const inputData = inputs[inputHandleId];
				const container = new Container();

				// Apply Geometry Transforms
				container.x = layer.x ?? 0;
				container.y = layer.y ?? 0;
				container.rotation = ((layer.rotation ?? 0) * Math.PI) / 180;

				let displayObject: Sprite | Text | null = null;

				if (inputData.type === "Image") {
					try {
						const texture = await Assets.load({
							src: inputData.value,
							parser: "texture",
						});
						const sprite = new Sprite(texture);

						// Dimensions
						if (layer.width) sprite.width = layer.width;

						if (layer.height) sprite.height = layer.height;

						displayObject = sprite;
					} catch (e) {
						console.warn(`Layer render failed for ${inputHandleId}`, e);
					}
				} else if (inputData.type === "Text") {
					const fontSize = layer.fontSize ?? 24;
					const lineHeight = layer.lineHeight ?? 1.2;

					const style = new TextStyle({
						fontFamily: layer.fontFamily ?? "Geist",
						fontSize,
						padding: 1, // Avoid clipping ascenders/descenders
						letterSpacing: layer.letterSpacing ?? 0,
						lineHeight: fontSize * lineHeight,
						align: layer.align ?? "left",
						fill: layer.fill ?? "#fff",
						wordWrap: true,
						whiteSpace: "normal",
						wordWrapWidth: layer.width ? layer.width : width - (layer.x || 0),
						breakWords: true,
					});

					displayObject = new Text({ text: inputData.value, style });
					displayObject.resolution = 2; // sharper text
				}

				if (displayObject) {
					this.applyBlendMode(displayObject, layer.blendMode || "normal", app);
					container.addChild(displayObject);
					// addChild adds to the top of the stack, so iterating sortedLayers (low to high z)
					// naturally places higher z visually on top.
					app.stage.addChild(container);
				}
			}

			app.render();
			const dataUrl = await app.renderer.extract.base64(app.stage);
			return { dataUrl, width, height };
		}, signal);
	}

	private applyBlendMode(obj: any, mode: string, app: Application) {
		const map: Record<string, BLEND_MODES> = {
			"source-over": "normal",
			multiply: "multiply",
			screen: "screen",
			overlay: "overlay",
			darken: "darken",
			lighten: "lighten",
			"color-dodge": "color-dodge",
			"color-burn": "color-burn",
			"hard-light": "hard-light",
			"soft-light": "soft-light",
			difference: "difference",
			exclusion: "exclusion",
			saturation: "saturation",
			color: "color",
			luminosity: "luminosity",
			normal: "normal",
		};

		const pixiBlendMode = map[mode] || "normal";
		const standardModes: BLEND_MODES[] = ["normal", "multiply", "screen"];

		if (standardModes.includes(pixiBlendMode)) {
			obj.blendMode = pixiBlendMode;
		} else {
			// Advanced blend modes via filters
			const blendFilterMap: Record<string, new () => BlendModeFilter> = {
				color: ColorBlend,
				"color-burn": ColorBurnBlend,
				"color-dodge": ColorDodgeBlend,
				darken: DarkenBlend,
				difference: DifferenceBlend,
				exclusion: ExclusionBlend,
				"hard-light": HardLightBlend,
				lighten: LightenBlend,
				luminosity: LuminosityBlend,
				overlay: OverlayBlend,
				saturation: SaturationBlend,
				"soft-light": SoftLightBlend,
			};

			const FilterClass = blendFilterMap[pixiBlendMode];
			if (FilterClass) {
				const blendFilter = new FilterClass();
				blendFilter.resolution = app.renderer.resolution;
				obj.filters = [blendFilter];
			} else {
				obj.blendMode = "normal";
			}
		}
	}
}

export const pixiProcessor = new PixiProcessorService();
