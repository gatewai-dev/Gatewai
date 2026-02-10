import type { Filter, Sprite, Container, Graphics, Texture, IRenderer, Application } from "./pixi-types-stub.js";

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
            }
        ) => Promise<void> | void,
        apiKey?: string
    ): Promise<Blob>;

    createTexture(url: string, apiKey?: string): Promise<Texture>;

    extract(target: Container, renderer: IRenderer): Promise<Blob>;
}
