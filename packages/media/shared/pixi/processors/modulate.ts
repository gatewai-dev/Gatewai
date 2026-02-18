import type { ModulateNodeConfig } from "@gatewai/core/types";
import { BuildModulateFilter } from "../filters/modulate";
import type { PixiProcessor, PixiProcessorContext } from "../types";

export interface ModulateInput {
	imageUrl: string;
	config: ModulateNodeConfig;
	apiKey?: string;
}

export const ModulateProcessor: PixiProcessor<ModulateInput> = {
	id: "modulate",
	async process(
		context: PixiProcessorContext,
		input: ModulateInput,
	): Promise<PixiProcessOutput> {
		const { imageUrl, config, apiKey } = input;
		const { app, loadTexture, getPixiModules, extractBlob, signal } = context;

		const texture = await loadTexture(imageUrl, apiKey);
		if (signal?.aborted) throw new Error("Operation cancelled");

		const { Sprite, Filter } = await getPixiModules();
		const sprite = new Sprite(texture);

		// Strict resizing of the renderer to match image dimensions
		app.renderer.resize(texture.width, texture.height);

		const FilterClass = BuildModulateFilter(Filter);
		const filter = new FilterClass(config);
		sprite.filters = [filter];

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
