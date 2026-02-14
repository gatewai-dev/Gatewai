import type { PixiProcessor, PixiProcessorContext } from "../types";

export interface ResizeInput {
	imageUrl: string;
	options: { width?: number; height?: number };
	apiKey?: string;
}

export interface ResizeOutput {
	dataUrl: Blob;
	width: number;
	height: number;
}

export const ResizeProcessor: PixiProcessor<ResizeInput, ResizeOutput> = {
	id: "resize",
	async process(
		context: PixiProcessorContext,
		input: ResizeInput,
	): Promise<ResizeOutput> {
		const { imageUrl, options, apiKey } = input;
		const { app, loadTexture, getPixiModules, extractBlob, signal } = context;

		const texture = await loadTexture(imageUrl, apiKey);
		if (signal?.aborted) throw new Error("Operation cancelled");

		const { Sprite } = await getPixiModules();
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
			targetHeight = Math.round(originalHeight * (targetWidth / originalWidth));
		} else if (!targetWidth && targetHeight) {
			targetWidth = Math.round(originalWidth * (targetHeight / originalHeight));
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

		if (signal?.aborted) throw new Error("Operation cancelled");
		app.render();

		const dataUrl = await extractBlob(app.stage);

		return { dataUrl, width: targetWidth, height: targetHeight };
	},
};
