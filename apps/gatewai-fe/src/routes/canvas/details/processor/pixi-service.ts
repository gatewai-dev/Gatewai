import type {
	CompositorLayer,
	CompositorNodeConfig,
	ModulateNodeConfig,
	PaintNodeConfig,
} from "@gatewai/types";
import {
	Application,
	Assets,
	type BLEND_MODES,
	BlurFilter,
	Container,
	Graphics,
	Sprite,
	Text,
	TextStyle,
} from "pixi.js";
import "pixi.js/advanced-blend-modes";
import {
	ColorBlend,
	ColorBurnBlend,
	ColorDodgeBlend,
	DarkenBlend,
	DifferenceBlend,
	ExclusionBlend,
	HardLightBlend,
	LightenBlend,
	LuminosityBlend,
	OverlayBlend,
	SaturationBlend,
	SoftLightBlend,
} from "pixi.js";
import { ModulateFilter } from "./filters/modulate";

class PixiProcessorService {
	private app: Application | null = null;

	// Initialize a single shared, background Pixi Application
	private async init() {
		if (this.app) return;

		this.app = new Application();

		await this.app.init({
			width: 1024,
			height: 1024,
			autoStart: false,
			backgroundAlpha: 0,
			preference: "webgpu",
			webgpu: {
				hello: true,
			},
			webgl: {
				hello: true,
			},
			useBackBuffer: true,
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
		if (signal?.aborted) {
			throw new DOMException("Operation cancelled", "AbortError");
		}

		if (!this.app) await this.init();
		if (!this.app) throw new Error("App is not initialized");
		const app = this.app;

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
		app.stage.removeChildren();
		app.stage.addChild(sprite);

		// Check cancellation before rendering
		if (signal?.aborted) {
			app.stage.removeChildren();
			throw new DOMException("Operation cancelled", "AbortError");
		}

		app.render();

		// Check cancellation before extraction
		if (signal?.aborted) {
			app.stage.removeChildren();
			throw new DOMException("Operation cancelled", "AbortError");
		}

		// 5. Extract Result
		const dataUrl = await app.renderer.extract.base64(app.stage);
		console.log({ dataUrl });
		// Final cancellation check
		if (signal?.aborted) {
			throw new DOMException("Operation cancelled", "AbortError");
		}

		return { dataUrl, width: app.renderer.width, height: app.renderer.height };
	}

	public async processBlur(
		imageUrl: string,
		options: { blurSize: number },
		signal?: AbortSignal,
	): Promise<{ dataUrl: string; width: number; height: number }> {
		if (signal?.aborted) {
			throw new DOMException("Operation cancelled", "AbortError");
		}

		if (!this.app) await this.init();
		if (!this.app) throw new Error("App is not initialized");
		const app = this.app;

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
		blurFilter.quality = 2;

		sprite.filters = [blurFilter];

		// 4. Render to Stage
		app.stage.removeChildren();
		app.stage.addChild(sprite);

		// Check cancellation before rendering
		if (signal?.aborted) {
			app.stage.removeChildren();
			throw new DOMException("Operation cancelled", "AbortError");
		}

		app.render();

		// Check cancellation before extraction
		if (signal?.aborted) {
			app.stage.removeChildren();
			throw new DOMException("Operation cancelled", "AbortError");
		}

		// 5. Extract Result
		const dataUrl = await app.renderer.extract.base64(app.stage);

		// Final cancellation check
		if (signal?.aborted) {
			throw new DOMException("Operation cancelled", "AbortError");
		}

		return { dataUrl, width: app.renderer.width, height: app.renderer.height };
	}

	/**
	 * Process resize with cancellation support
	 */
	public async processResize(
		imageUrl: string,
		options: { width?: number; height?: number },
		signal?: AbortSignal,
	): Promise<{ dataUrl: string; width: number; height: number }> {
		if (signal?.aborted) {
			throw new DOMException("Operation cancelled", "AbortError");
		}

		if (!this.app) await this.init();
		if (!this.app) throw new Error("App is not initialized");
		const app = this.app;

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
			console.log(`Resizing to ${options.width}x${options.height}`);
			// Resize the renderer to match the target dimensions
			app.renderer.resize(options.width, options.height);
		} else {
			app.renderer.resize(targetWidth, targetHeight);
		}

		// 3. Render to Stage
		app.stage.removeChildren();
		app.stage.addChild(sprite);

		// Check cancellation before rendering
		if (signal?.aborted) {
			app.stage.removeChildren();
			throw new DOMException("Operation cancelled", "AbortError");
		}

		app.render();

		// Check cancellation before extraction
		if (signal?.aborted) {
			app.stage.removeChildren();
			throw new DOMException("Operation cancelled", "AbortError");
		}

		// 4. Extract Result
		const dataUrl = await app.renderer.extract.base64(app.stage);

		// Final cancellation check
		if (signal?.aborted) {
			throw new DOMException("Operation cancelled", "AbortError");
		}

		return { dataUrl, width: targetWidth, height: targetHeight };
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
		if (signal?.aborted) {
			throw new DOMException("Operation cancelled", "AbortError");
		}

		if (!this.app) await this.init();
		if (!this.app) throw new Error("App is not initialized");
		const app = this.app;

		if (signal?.aborted) {
			throw new DOMException("Operation cancelled", "AbortError");
		}

		// 1. Load the Texture
		const texture = await Assets.load({
			src: imageUrl,
			parser: "texture",
		});

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
		app.stage.removeChildren();
		app.stage.addChild(container);

		if (signal?.aborted) {
			app.stage.removeChildren();
			throw new DOMException("Operation cancelled", "AbortError");
		}

		app.render();

		if (signal?.aborted) {
			app.stage.removeChildren();
			throw new DOMException("Operation cancelled", "AbortError");
		}

		// 4. Extract Result - extract the container, not the stage
		const dataUrl = await app.renderer.extract.base64(container);

		if (signal?.aborted) {
			throw new DOMException("Operation cancelled", "AbortError");
		}

		return { dataUrl, width: widthPx, height: heightPx };
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
		if (signal?.aborted) {
			throw new DOMException("Operation cancelled", "AbortError");
		}
		const { backgroundColor } = config;

		if (!this.app) await this.init();
		if (!this.app) throw new Error("App is not initialized");
		const app = this.app;

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

		app.stage.removeChildren();
		app.stage.addChild(container);

		if (signal?.aborted) {
			app.stage.removeChildren();
			throw new DOMException("Operation cancelled", "AbortError");
		}

		app.render();

		if (signal?.aborted) {
			app.stage.removeChildren();
			throw new DOMException("Operation cancelled", "AbortError");
		}

		const onlyMaskDataUrl = await app.renderer.extract.base64(app.stage);

		if (signal?.aborted) {
			app.stage.removeChildren();
			throw new DOMException("Operation cancelled", "AbortError");
		}
		console.log({ onlyMask: onlyMaskDataUrl });

		// 4. Now add the base sprite behind the mask for imageWithMask
		if (baseSprite) {
			container.addChildAt(baseSprite, 0);
		}

		if (signal?.aborted) {
			app.stage.removeChildren();
			throw new DOMException("Operation cancelled", "AbortError");
		}

		app.render();

		if (signal?.aborted) {
			app.stage.removeChildren();
			throw new DOMException("Operation cancelled", "AbortError");
		}

		const imageWithMaskDataUrl = await app.renderer.extract.base64(app.stage);

		if (signal?.aborted) {
			app.stage.removeChildren();
			throw new DOMException("Operation cancelled", "AbortError");
		}

		// Clean up
		app.stage.removeChildren();

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
	}

	public async processCompositor(
		config: CompositorNodeConfig,
		inputs: Map<string, { type: "Image" | "Text"; value: string }>,
		signal?: AbortSignal,
	): Promise<{ dataUrl: string; width: number; height: number }> {
		console.log("PPWPWP");
		if (signal?.aborted) {
			throw new DOMException("Operation cancelled", "AbortError");
		}
		const getBlendMode = (mode: string): BLEND_MODES => {
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
			return (map[mode] as BLEND_MODES) || "normal";
		};

		const blendFilterMap: Record<string, new () => any> = {
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

		if (!this.app) await this.init();
		if (!this.app) throw new Error("App is not initialized");
		const app = this.app;

		// 1. Setup Canvas Dimensions
		// Default to 800x600 if not specified (matching UI default)
		const width = config.width || 800;
		const height = config.height || 600;

		app.renderer.resize(width, height);
		app.stage.removeChildren();

		// 2. Iterate and Render Layers
		// Note: We rely on Object.values() preserving insertion order for integer-like strings
		// or standard string keys created during the UI save process.
		const layers = Object.values(config.layerUpdates || {});
		console.log({ config });
		for (const layer of layers) {
			if (signal?.aborted) break;

			const inputData = inputs.get(layer.inputHandleId);
			if (!inputData) continue; // Skip layers with missing inputs

			const container = new Container();

			// Common Transform Properties
			container.x = layer.x || 0;
			container.y = layer.y || 0;
			container.scale.set(layer.scaleX || 1, layer.scaleY || 1);
			// Konva uses degrees, Pixi uses radians
			container.rotation = ((layer.rotation || 0) * Math.PI) / 180;

			let obj: Sprite | Text | null = null;

			if (layer.type === "Image" && inputData.type === "Image") {
				try {
					const texture = await Assets.load({
						src: inputData.value,
						parser: "texture",
					});

					if (signal?.aborted) break;

					const sprite = new Sprite(texture);

					// Apply specific dimensions if they exist (override natural size)
					// In the UI, width/height are often derived from the image,
					// but if the user resized the handle without scaling, we might need this.
					// However, the UI uses scaleX/scaleY primarily.
					// We'll trust the container scaling unless width/height are explicit and differ from texture.

					obj = sprite;
				} catch (e) {
					console.warn(`Failed to load texture for layer ${layer.id}`, e);
				}
			} else if (layer.type === "Text" && inputData.type === "Text") {
				const style = new TextStyle({
					fontFamily: layer.fontFamily || "sans-serif",
					fontSize: layer.fontSize || 24,
					fill: layer.fill || "#000000",
				});

				const text = new Text({ text: inputData.value, style });

				// Apply Width constraint if necessary (wrapping),
				// though Konva usually handles text width differently.
				if (layer.width) {
					text.style.wordWrap = true;
					text.style.wordWrapWidth = layer.width;
				}

				obj = text;
			}

			if (obj) {
				// Apply blend mode
				const blendModeStr = layer.blendMode || "normal";
				const pixiBlendMode = getBlendMode(blendModeStr);
				const basicModes: BLEND_MODES[] = ["normal", "multiply", "screen"];

				if (basicModes.includes(pixiBlendMode)) {
					obj.blendMode = pixiBlendMode;
				} else {
					const FilterClass = blendFilterMap[pixiBlendMode];
					if (FilterClass) {
						const blendFilter = new FilterClass();
						blendFilter.resolution = app.renderer.resolution;
						obj.filters = [blendFilter];
					} else {
						console.warn(`Unsupported blend mode: ${blendModeStr}`);
						obj.blendMode = "normal";
					}
				}

				container.addChild(obj);
				app.stage.addChild(container);
			}
		}

		if (signal?.aborted) {
			app.stage.removeChildren();
			throw new DOMException("Operation cancelled", "AbortError");
		}

		app.render();

		if (signal?.aborted) {
			app.stage.removeChildren();
			throw new DOMException("Operation cancelled", "AbortError");
		}

		const dataUrl = await app.renderer.extract.base64(app.stage);

		// Cleanup
		app.stage.removeChildren();

		return { dataUrl, width, height };
	}
}

export const pixiProcessor = new PixiProcessorService();
