import {
	Application,
	Assets,
	Sprite,
	BlurFilter,
	Container,
	Graphics,
} from "pixi.js";

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
		});
	}

	/**
	 * Process blur with cancellation support
	 */
	public async processBlur(
		imageUrl: string,
		options: { blurSize: number },
		signal?: AbortSignal,
	): Promise<string> {
		if (signal?.aborted) {
			throw new DOMException("Operation cancelled", "AbortError");
		}

		if (!this.app) await this.init();
		const app = this.app!;

		// Check cancellation before loading
		if (signal?.aborted) {
			throw new DOMException("Operation cancelled", "AbortError");
		}

		// 1. Load the Texture
		const texture = await Assets.load(imageUrl);

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
		blurFilter.quality = 4; // High quality

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

		return dataUrl;
	}

	/**
	 * Process resize with cancellation support
	 */
	public async processResize(
		imageUrl: string,
		options: { width?: number; height?: number },
		signal?: AbortSignal,
	): Promise<string> {
		if (signal?.aborted) {
			throw new DOMException("Operation cancelled", "AbortError");
		}

		if (!this.app) await this.init();
		const app = this.app!;

		// Check cancellation before loading
		if (signal?.aborted) {
			throw new DOMException("Operation cancelled", "AbortError");
		}

		// 1. Load the Texture
		const texture = await Assets.load(imageUrl);

		// Check cancellation after loading
		if (signal?.aborted) {
			throw new DOMException("Operation cancelled", "AbortError");
		}

		// 2. Setup the Scene
		const sprite = new Sprite(texture);

		if (options.width && options.height) {
			// Set the desired dimensions for the sprite
			sprite.width = options.width;
			sprite.height = options.height;
			console.log(`Resizing to ${options.width}x${options.height}`);
			// Resize the renderer to match the target dimensions
			app.renderer.resize(options.width, options.height);
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

		return dataUrl;
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
	): Promise<string> {
		if (signal?.aborted) {
			throw new DOMException("Operation cancelled", "AbortError");
		}

		if (!this.app) await this.init();
		const app = this.app!;

		if (signal?.aborted) {
			throw new DOMException("Operation cancelled", "AbortError");
		}

		// 1. Load the Texture
		const texture = await Assets.load(imageUrl);

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

		return dataUrl;
	}

	/**
	 * Process mask
	 * Returns image with mask overlay and the mask alone
	 */
	public async processMask(
		imageUrl: string | undefined,
		maskUrl: string,
		backgroundColor?: string,
		signal?: AbortSignal,
	): Promise<{ imageWithMask: string; onlyMask: string }> {
		if (signal?.aborted) {
			throw new DOMException("Operation cancelled", "AbortError");
		}

		if (!this.app) await this.init();
		const app = this.app!;

		if (signal?.aborted) {
			throw new DOMException("Operation cancelled", "AbortError");
		}

		// 1. Load the mask texture
		const maskTexture = await Assets.load(maskUrl);

		if (signal?.aborted) {
			throw new DOMException("Operation cancelled", "AbortError");
		}

		let baseSprite: Sprite | Graphics;

		// 2. Load image if provided, otherwise create colored background
		if (imageUrl) {
			const texture = await Assets.load(imageUrl);

			if (signal?.aborted) {
				throw new DOMException("Operation cancelled", "AbortError");
			}

			if (
				texture.width !== maskTexture.width ||
				texture.height !== maskTexture.height
			) {
				throw new Error("Image and mask dimensions do not match");
			}

			baseSprite = new Sprite(texture);
		} else if (backgroundColor) {
			// Create a colored background using Graphics
			const graphics = new Graphics();
			graphics.beginFill(backgroundColor);
			graphics.drawRect(0, 0, maskTexture.width, maskTexture.height);
			graphics.endFill();
			baseSprite = graphics;
		} else {
			throw new Error("Either imageUrl or backgroundColor must be provided");
		}

		// Resize the renderer to match dimensions
		app.renderer.resize(maskTexture.width, maskTexture.height);

		// 3. Setup the Scene with Container
		const container = new Container();
		const maskSprite = new Sprite(maskTexture);

		container.addChild(baseSprite);
		container.addChild(maskSprite);

		// 4. Render to Stage for imageWithMask
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

		const imageWithMask = await app.renderer.extract.base64(app.stage);

		if (signal?.aborted) {
			app.stage.removeChildren();
			throw new DOMException("Operation cancelled", "AbortError");
		}

		// 5. Modify for onlyMask
		container.removeChild(baseSprite);
		maskSprite.alpha = 1.0; // Full opacity for mask alone

		app.render();

		if (signal?.aborted) {
			app.stage.removeChildren();
			throw new DOMException("Operation cancelled", "AbortError");
		}

		const onlyMask = await app.renderer.extract.base64(app.stage);

		if (signal?.aborted) {
			throw new DOMException("Operation cancelled", "AbortError");
		}

		return { imageWithMask, onlyMask };
	}
}

export const pixiProcessor = new PixiProcessorService();
