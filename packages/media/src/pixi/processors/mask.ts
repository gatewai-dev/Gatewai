import type { PaintNodeConfig } from "@gatewai/core/types";
import type { Graphics, Sprite } from "pixi.js";
import type { PixiProcessor, PixiProcessorContext } from "../types";

export interface MaskInput {
	config: PaintNodeConfig;
	imageUrl: string | undefined;
	maskUrl?: string;
	apiKey?: string;
}

export interface MaskOutput {
	imageWithMask: { dataUrl: Blob; width: number; height: number };
	onlyMask: { dataUrl: Blob; width: number; height: number };
}

export const MaskProcessor: PixiProcessor<MaskInput, MaskOutput> = {
	id: "mask",
	async process(
		context: PixiProcessorContext,
		input: MaskInput,
	): Promise<MaskOutput> {
		const { config, imageUrl, maskUrl, apiKey } = input;
		const { backgroundColor } = config;
		const { app, loadTexture, getPixiModules, extractBlob, signal } = context;

		if (signal?.aborted) throw new Error("Operation cancelled");

		const { Container, Sprite, Graphics } = await getPixiModules();

		let widthToUse: number;
		let heightToUse: number;
		let baseSprite: Sprite | Graphics | undefined;

		// Determine dimensions and background
		if (imageUrl) {
			const texture = await loadTexture(imageUrl, apiKey);
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
			const maskTexture = await loadTexture(maskUrl, apiKey);
			maskSprite = new Sprite(maskTexture);
			maskSprite.width = widthToUse;
			maskSprite.height = heightToUse;
		}

		// 1. Render ONLY Mask
		if (maskSprite) {
			container.addChild(maskSprite);
		}
		app.stage.addChild(container);

		if (signal?.aborted) throw new Error("Operation cancelled");
		app.render();

		const onlyMaskDataUrl = await extractBlob(app.stage);

		// 2. Render Image + Mask
		if (baseSprite) {
			// Insert base image *below* the mask (index 1 because spacer is 0)
			container.addChildAt(baseSprite, 1);
		}

		if (signal?.aborted) throw new Error("Operation cancelled");
		app.render();

		const imageWithMaskDataUrl = await extractBlob(app.stage);

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
	},
};
