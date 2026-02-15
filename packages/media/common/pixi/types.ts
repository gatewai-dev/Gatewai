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
