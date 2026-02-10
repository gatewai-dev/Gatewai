import type { ModulateNodeConfig, PaintNodeConfig } from "./config/index.js";
import type {
	Application,
	Container,
	Filter,
	Graphics,
	IRenderer,
	Sprite,
	Texture,
} from "./pixi-types-stub.js";

/**
 * Common interface for Pixi.js processing service.
 * Allows decoupling the implementation (@gatewai/pixi-processor) from consumers.
 */
export interface IPixiProcessor {
	processImage(
		imageUrl: string,
		operations: (
			app: Application,
			sprite: Sprite,
			resources: {
				Filter: typeof Filter;
				Sprite: typeof Sprite;
				Container: typeof Container;
				Graphics: typeof Graphics;
				[key: string]: unknown;
			},
		) => Promise<void> | void,
		apiKey?: string,
	): Promise<Blob>;

	createTexture(url: string, apiKey?: string): Promise<Texture>;

	extract(target: Container, renderer: IRenderer): Promise<Blob>;

	execute<TInput = unknown, TOutput = unknown>(
		id: string,
		input: TInput,
		signal?: AbortSignal,
	): Promise<TOutput>;

	processModulate(
		imageUrl: string,
		config: ModulateNodeConfig,
		signal?: AbortSignal,
		apiKey?: string,
	): Promise<{ dataUrl: Blob; width: number; height: number }>;

	processBlur(
		imageUrl: string,
		options: { blurSize: number },
		signal?: AbortSignal,
		apiKey?: string,
	): Promise<{ dataUrl: Blob; width: number; height: number }>;

	processResize(
		imageUrl: string,
		options: { width?: number; height?: number },
		signal?: AbortSignal,
		apiKey?: string,
	): Promise<{ dataUrl: Blob; width: number; height: number }>;

	processCrop(
		imageUrl: string,
		options: {
			leftPercentage: number;
			topPercentage: number;
			widthPercentage: number;
			heightPercentage: number;
		},
		signal?: AbortSignal,
		apiKey?: string,
	): Promise<{ dataUrl: Blob; width: number; height: number }>;

	processMask(
		config: PaintNodeConfig,
		imageUrl: string | undefined,
		maskUrl?: string,
		signal?: AbortSignal,
		apiKey?: string,
	): Promise<{
		imageWithMask: { dataUrl: Blob; width: number; height: number };
		onlyMask: { dataUrl: Blob; width: number; height: number };
	}>;
}
