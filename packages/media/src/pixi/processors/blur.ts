import type { PixiProcessor, PixiProcessorContext } from "../types";

export interface BlurInput {
	imageUrl: string;
	options: { blurSize: number };
	apiKey?: string;
}

export interface BlurOutput {
	dataUrl: Blob;
	width: number;
	height: number;
}

export const BlurProcessor: PixiProcessor<BlurInput, BlurOutput> = {
	id: "blur",
	async process(
		context: PixiProcessorContext,
		input: BlurInput,
	): Promise<BlurOutput> {
		const { imageUrl, options, apiKey } = input;
		const { app, loadTexture, getPixiModules, extractBlob, signal } = context;

		const texture = await loadTexture(imageUrl, apiKey);
		if (signal?.aborted) throw new Error("Operation cancelled");

		const { Sprite, BlurFilter } = await getPixiModules();
		const sprite = new Sprite(texture);

		app.renderer.resize(texture.width, texture.height);

		const strength = Math.max(0, options.blurSize);
		// 8 is high quality blur
		const blurFilter = new BlurFilter(strength, 8);
		// Padding ensures blur doesn't get clipped at edges if extract uses bounds
		blurFilter.padding = strength;

		sprite.filters = [blurFilter];
		app.stage.addChild(sprite);

		if (signal?.aborted) throw new Error("Operation cancelled");
		app.render();

		const dataUrl = await extractBlob(app.stage);

		return {
			dataUrl,
			width: app.renderer.width,
			height: app.renderer.height,
		};
	},
};
