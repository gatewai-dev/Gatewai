import type {
	PixiProcessOutput,
	PixiRun,
	PixiRunContext,
} from "@gatewai/core/types";
import type { BlurNodeConfig } from "./config.js";

export interface PixiBlurInput {
	imageUrl: string;
	options: BlurNodeConfig;
	apiKey?: string;
}

export const applyBlur: PixiRun<PixiBlurInput> = {
	id: "blur",
	async run(
		context: PixiRunContext,
		input: PixiBlurInput,
	): Promise<PixiProcessOutput> {
		const { imageUrl, options, apiKey } = input;
		console.log({ input });
		const { app, loadTexture, getPixiModules, extractBlob, signal } = context;

		const texture = await loadTexture(imageUrl, apiKey);
		if (signal?.aborted) throw new Error("Operation cancelled");

		const { Sprite, BlurFilter } = await getPixiModules();
		const sprite = new Sprite(texture);

		app.renderer.resize(texture.width, texture.height);

		const strength = Math.max(0, options.size);
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
