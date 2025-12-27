import { Application, Assets, Sprite, BlurFilter } from 'pixi.js';

class PixiProcessorService {
  private app: Application | null = null;

  // Initialize a single shared, background Pixi Application
  private async init() {
    if (this.app) return;
    
    // Use a background canvas that is never attached to the DOM
    this.app = new Application();
    
    await this.app.init({
      width: 1024,
      height: 1024,
      autoStart: false,
      backgroundAlpha: 0,
      preserveDrawingBuffer: true,
      preference: 'webgpu',
    });
  }

  /**
   * Process blur with cancellation support
   */
  public async processBlur(
    imageUrl: string, 
    options: { blurSize: number },
    signal?: AbortSignal
  ): Promise<string> {
    if (signal?.aborted) {
      throw new DOMException('Operation cancelled', 'AbortError');
    }

    if (!this.app) await this.init();
    const app = this.app!;

    // Check cancellation before loading
    if (signal?.aborted) {
      throw new DOMException('Operation cancelled', 'AbortError');
    }

    // 1. Load the Texture
    const texture = await Assets.load(imageUrl);
    
    // Check cancellation after loading
    if (signal?.aborted) {
      throw new DOMException('Operation cancelled', 'AbortError');
    }

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
    
    // Check cancellation before rendering
    if (signal?.aborted) {
      app.stage.removeChildren();
      throw new DOMException('Operation cancelled', 'AbortError');
    }
    
    app.render();

    // Check cancellation before extraction
    if (signal?.aborted) {
      app.stage.removeChildren();
      throw new DOMException('Operation cancelled', 'AbortError');
    }

    // 5. Extract Result
    const dataUrl = await app.renderer.extract.base64(app.stage);

    // Final cancellation check
    if (signal?.aborted) {
      throw new DOMException('Operation cancelled', 'AbortError');
    }

    return dataUrl;
  }

  /**
   * Process resize with cancellation support
   */
  public async processResize(
    imageUrl: string,
    options: { width?: number; height?: number },
    signal?: AbortSignal
  ): Promise<string> {
    if (signal?.aborted) {
      throw new DOMException('Operation cancelled', 'AbortError');
    }

    if (!this.app) await this.init();
    const app = this.app!;

    // Check cancellation before loading
    if (signal?.aborted) {
      throw new DOMException('Operation cancelled', 'AbortError');
    }

    // 1. Load the Texture
    const texture = await Assets.load(imageUrl);

    // Check cancellation after loading
    if (signal?.aborted) {
      throw new DOMException('Operation cancelled', 'AbortError');
    }

    // 2. Setup the Scene
    const sprite = new Sprite(texture);
    
    if (options.width && options.height) {
      // Set the desired dimensions for the sprite
      sprite.width = options.width;
      sprite.height = options.height;
      console.log(`Resizing to ${options.width}x${options.height}`);
      // Resize the renderer to match the target dimensions
      app.renderer.resize(options.width, options.height);
    }

    // 3. Render to Stage
    app.stage.removeChildren();
    app.stage.addChild(sprite);
    
    // Check cancellation before rendering
    if (signal?.aborted) {
      app.stage.removeChildren();
      throw new DOMException('Operation cancelled', 'AbortError');
    }
    
    app.render();

    // Check cancellation before extraction
    if (signal?.aborted) {
      app.stage.removeChildren();
      throw new DOMException('Operation cancelled', 'AbortError');
    }

    // 4. Extract Result
    const dataUrl = await app.renderer.extract.base64(app.stage);

    // Final cancellation check
    if (signal?.aborted) {
      throw new DOMException('Operation cancelled', 'AbortError');
    }

    return dataUrl;
  }
}

export const pixiProcessor = new PixiProcessorService();