import { BasePixiService } from "@gatewai/pixi-processor";
import {
	Application,
	Assets,
	type Container,
	type IRenderer,
	type Texture,
} from "@pixi/node";

export class BackendPixiService extends BasePixiService {
	protected createApplication(): Application {
		// @pixi/node V7 Application is designed for server-side
		return new Application({
			width: 1024,
			height: 1024,
			autoStart: false,
			backgroundColor: 0xffffff,
			backgroundAlpha: 0,
			preserveDrawingBuffer: true,
		});
	}

	protected async loadTexture(url: string): Promise<Texture> {
		// In Node, Assets.load works if fetch is polyfilled, or use Texture.from
		return await Assets.load(url);
	}

	protected extractBase64(renderer: IRenderer, target: Container): string {
		// V7 Node: plugins.extract.base64 is synchronous
		return renderer.plugins.extract.base64(target);
	}
}

export const backendPixiService = new BackendPixiService();
