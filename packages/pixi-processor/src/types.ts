import type {
	Application,
	BlurFilter,
	Container,
	Filter,
	Graphics,
	Rectangle,
	Sprite,
	Texture,
} from "pixi.js";

export interface PixiModules {
	Sprite: typeof Sprite;
	Container: typeof Container;
	Graphics: typeof Graphics;
	Texture: typeof Texture;
	BlurFilter: typeof BlurFilter;
	Filter: typeof Filter;
	Rectangle: typeof Rectangle;
}

export interface PixiProcessorContext {
	app: Application;
	loadTexture(url: string, apiKey?: string): Promise<Texture>;
	getPixiModules(): Promise<PixiModules>;
	extractBlob(target: Container): Promise<Blob>;
	signal?: AbortSignal;
}

// biome-ignore lint/suspicious/noExplicitAny: <explanation>
export interface PixiProcessor<TInput = any, TOutput = any> {
	id: string;
	process(context: PixiProcessorContext, input: TInput): Promise<TOutput>;
}
