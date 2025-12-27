import { Application, Assets, Sprite, BlurFilter } from 'pixi.js';

class PixiProcessorService {
  private app: Application | null = null;

  // Initialize a single shared, background Pixi Application
  private async init() {
    if (this.app) return;
    
    // Use a background canvas that is never attached to the DOM
    this.app = new Application();
    
    await this.app.init({
      width: 1024, // Default buffer size, will resize dynamically
      height: 1024,
      autoStart: false, // We only render on demand
      backgroundAlpha: 0,
      preserveDrawingBuffer: true, // Required to extract data
      preference: 'webgl',
    });
  }

  public async processBlur(
    imageUrl: string, 
    options: { blurSize: number }
  ): Promise<string> {
    if (!this.app) await this.init();
    const app = this.app!;

    // 1. Load the Texture
    const texture = await Assets.load(imageUrl);
    
    // 2. Setup the Scene
    const sprite = new Sprite(texture);
    
    // Resize the renderer to match the image exactly
    app.renderer.resize(sprite.width, sprite.height);
    
    // 3. Apply Filter
    const strength = Math.max(0, options.blurSize);
    
    const blurFilter = new BlurFilter();
    blurFilter.strength = strength;
    blurFilter.quality = 4; // High quality

    sprite.filters = [blurFilter];

    // 4. Render to Stage
    app.stage.removeChildren();
    app.stage.addChild(sprite);
    
    app.render();

    // 5. Extract Result
    const dataUrl = await app.renderer.extract.base64(app.stage);

    return dataUrl;
  }

  public async processResize(
    imageUrl: string,
    options: { width: number; height: number }
  ): Promise<string> {
    if (!this.app) await this.init();
    const app = this.app!;

    // 1. Load the Texture
    const texture = await Assets.load(imageUrl);

    // 2. Setup the Scene
    const sprite = new Sprite(texture);
    
    // Set the desired dimensions for the sprite
    sprite.width = options.width;
    sprite.height = options.height;
    
    // Resize the renderer to match the target dimensions
    app.renderer.resize(options.width, options.height);

    // 3. Render to Stage
    app.stage.removeChildren();
    app.stage.addChild(sprite);
    
    app.render();

    // 4. Extract Result
    const dataUrl = await app.renderer.extract.base64(app.stage);

    return dataUrl;
  }
}

export const pixiProcessor = new PixiProcessorService();