import type {
	PixiProcessOutput,
	PixiRun,
	PixiRunContext,
} from "@gatewai/core/types";
import type { CropNodeConfig } from "./config.js";

export interface PixiCropInput {
	imageUrl: string;
	options: CropNodeConfig;
	apiKey?: string;
}

export const applyCrop: PixiRun<PixiCropInput> = {
	id: "crop",
	async run(
		context: PixiRunContext,
		input: PixiCropInput,
	): Promise<PixiProcessOutput> {
		const { imageUrl, options, apiKey } = input;
		const { app, loadTexture, getPixiModules, extractBlob, signal } = context;

		const originalTexture = await loadTexture(imageUrl, apiKey);
		if (signal?.aborted) throw new Error("Operation cancelled");

		const { Sprite, Rectangle, Texture } = await getPixiModules();

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

		// Create a new texture with the cropped frame
		const frame = new Rectangle(leftPx, topPx, widthPx, heightPx);
		const croppedTexture = new Texture(originalTexture.baseTexture, frame);

		const sprite = new Sprite(croppedTexture);

		app.renderer.resize(widthPx, heightPx);
		app.stage.addChild(sprite);

		if (signal?.aborted) throw new Error("Operation cancelled");
		app.render();

		const dataUrl = await extractBlob(app.stage);

		return { dataUrl, width: widthPx, height: heightPx };
	},
};
