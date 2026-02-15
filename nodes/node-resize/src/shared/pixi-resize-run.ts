import type {
	PixiProcessOutput,
	PixiRun,
	PixiRunContext,
} from "@gatewai/core/types";
import type { ResizeNodeConfig } from "./config.js";

export interface PixiResizeInput {
	imageUrl: string;
	options: ResizeNodeConfig;
	apiKey?: string;
}

export const applyResize: PixiRun<PixiResizeInput> = {
	id: "resize",
	async run(
		context: PixiRunContext,
		input: PixiResizeInput,
	): Promise<PixiProcessOutput> {
		const { imageUrl, options, apiKey } = input;
		const { app, loadTexture, getPixiModules, extractBlob, signal } = context;

		const texture = await loadTexture(imageUrl, apiKey);
		if (signal?.aborted) throw new Error("Operation cancelled");

		const { Sprite } = await getPixiModules();
		const sprite = new Sprite(texture);

		const originalWidth = texture.width;
		const originalHeight = texture.height;

		const targetWidth = options.width;
		const targetHeight = options.height;

		// Logic to preserve aspect ratio if one dimension is missing?
		// The config schema defines width/height as required numbers (DimensionSchema).
		// However, the original code handled undefined.
		// In the node config, `width` and `height` are required.
		// But if `maintainAspect` is true, we might want to adjust.
		// The original code:
		// if (!targetWidth && !targetHeight) ...

		// In the new system, `ResizeNodeConfig` likely has values from UI.
		// If `maintainAspect` is true, usually the user sets one dimension and the other is calculated, OR
		// the node logic should handle it.
		// The `ResizeNodeConfigSchema` has `width` and `height` as required.
		// But in the UI they might be set.

		// Let's replicate strict logic from original but adapt to schema.
		// If the schema requires them, they will be present.
		// But maybe we should respect `maintainAspect`.
		// If `maintainAspect` is true, how do we know which one to prioritize?
		// Usually dependent on which one changed last in UI, but here we just have values.
		// If both are provided, we just use them?
		// Or if `maintainAspect` is true, we might need to re-calculate?
		// The original code seemed to handle optional width/height.
		// Our schema says they are required.
		// So we will just use them as is, assuming UI handles the aspect ratio logic before saving config,
		// OR we trust the explicit values.

		// Wait, looking at `node-resize/src/metadata.ts`:
		// defaultConfig: { width: 1024, height: 1024, maintainAspect: true }
		// So they are always numbers.

		// So `targetWidth` and `targetHeight` will be numbers.
		// We can just use them directly.

		if (targetWidth <= 0 || targetHeight <= 0) {
			throw new Error("Invalid resize dimensions");
		}

		sprite.width = targetWidth;
		sprite.height = targetHeight;

		app.renderer.resize(targetWidth, targetHeight);
		app.stage.addChild(sprite);

		if (signal?.aborted) throw new Error("Operation cancelled");
		app.render();

		const dataUrl = await extractBlob(app.stage);

		return { dataUrl, width: targetWidth, height: targetHeight };
	},
};
