import type {
	Application,
	BlurFilter,
	Container,
	Filter,
	Graphics,
	IRenderer,
	Rectangle,
	Sprite,
	Texture,
} from "./pixi-types-stub.js";

export type PixiProcessOutput = {
	dataUrl: Blob;
	width: number;
	height: number;
};

export interface PixiModules {
	Sprite: typeof Sprite;
	Container: typeof Container;
	Graphics: typeof Graphics;
	Texture: typeof Texture;
	BlurFilter: typeof BlurFilter;
	Filter: typeof Filter;
	Rectangle: typeof Rectangle;
}

export interface PixiRunContext {
	app: Application;
	loadTexture(url: string, apiKey?: string): Promise<Texture>;
	getPixiModules(): Promise<PixiModules>;
	extractBlob(target: Container): Promise<Blob>;
	signal?: AbortSignal;
}

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export interface PixiRun<TInput = any, TOutput = any> {
	id: string;
	run(context: PixiRunContext, input: TInput): Promise<TOutput>;
}

/**
 * Common interface for Pixi.js processing service.
 * Allows decoupling the implementation (@gatewai/media/pixi) from consumers.
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

	execute<TInput = unknown, TOutput = PixiProcessOutput>(
		id: string,
		input: TInput,
		processor: PixiRun,
		signal?: AbortSignal,
	): Promise<TOutput>;
}
