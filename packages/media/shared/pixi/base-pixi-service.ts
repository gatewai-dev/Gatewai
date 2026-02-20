import { ServiceAbortError } from "@gatewai/core";
import type {
	IPixiProcessor,
	PixiRun,
	PixiRunContext,
} from "@gatewai/core/types";
import { createPool, type Pool } from "generic-pool";
import pLimit from "p-limit";
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
} from "pixi.js";

export interface PixiResource {
	app: Application;
	id: string;
}

export interface PixiPoolOptions {
	/** Maximum number of pooled Pixi applications. Defaults to 12. */
	maxPoolSize?: number;
	/** Minimum number of idle Pixi applications to keep warm. Defaults to 2. */
	minPoolSize?: number;
}

export abstract class BasePixiService implements IPixiProcessor {
	protected pool: Pool<PixiResource>;
	protected limit: ReturnType<typeof pLimit>;

	constructor(options: PixiPoolOptions = {}) {
		const maxSize = options.maxPoolSize ?? 12;
		const minSize = options.minPoolSize ?? 2;

		// Concurrency limiter must match pool max to avoid exhausting the pool while
		// queued tasks hold the limit slots.
		this.limit = pLimit(maxSize);

		this.pool = createPool(
			{
				create: () => this.createResource(),
				destroy: (resource) => this.destroyResource(resource),
				validate: (resource) => this.validateResource(resource),
			},
			{
				max: maxSize,
				min: minSize,
				testOnBorrow: true,
			},
		);
	}

	// ─── Abstract surface ────────────────────────────────────────────────────

	protected abstract createApplication(): Application;
	protected abstract loadTexture(
		url: string,
		apiKey?: string,
	): Promise<Texture>;
	protected abstract getPixiImport(): string;
	protected abstract extractBlob(
		renderer: IRenderer,
		target: Container,
	): Promise<Blob>;

	// ─── Pixi modules ────────────────────────────────────────────────────────

	/**
	 * Override to supply statically-imported Pixi modules (avoids a dynamic
	 * import round-trip on every call in environments that bundle eagerly).
	 */
	protected async getPixiModules(): Promise<{
		Sprite: typeof Sprite;
		Container: typeof Container;
		Graphics: typeof Graphics;
		Texture: typeof Texture;
		BlurFilter: typeof BlurFilter;
		Filter: typeof Filter;
		Rectangle: typeof Rectangle;
	}> {
		const pixi = await import(/* @vite-ignore */ this.getPixiImport());
		return {
			Sprite: pixi.Sprite,
			Container: pixi.Container,
			Graphics: pixi.Graphics,
			BlurFilter: pixi.BlurFilter,
			Filter: pixi.Filter,
			Rectangle: pixi.Rectangle,
			Texture: pixi.Texture,
		};
	}

	// ─── Pool resource lifecycle ──────────────────────────────────────────────

	private async createResource(): Promise<PixiResource> {
		const app = this.createApplication();
		return { app, id: Math.random().toString(36).substring(2, 9) };
	}

	private async destroyResource(resource: PixiResource): Promise<void> {
		// `true` as first arg removes the canvas view from the DOM (no-op in Node/worker).
		resource.app.destroy(true, {
			children: true,
			texture: true,
			baseTexture: true,
		});
	}

	private async validateResource(resource: PixiResource): Promise<boolean> {
		const renderer = resource.app?.renderer;
		if (!renderer) return false;

		// Detect WebGL context loss — gl property exists on WebGL renderers only.
		const gl: WebGLRenderingContext | undefined = (renderer as any).gl;
		if (gl?.isContextLost?.()) return false;

		return true;
	}

	// ─── Stage cleanup ────────────────────────────────────────────────────────

	/**
	 * Removes and destroys all stage children.
	 * `texture: false` keeps cached textures managed by `loadTexture` alive.
	 */
	private cleanupStage(app: Application): void {
		const children = app.stage.removeChildren();
		for (const child of children) {
			try {
				child.destroy({ children: true, texture: false, baseTexture: false });
			} catch {
				// Child may already be destroyed; swallow to keep pool healthy.
			}
		}
	}

	// ─── Abort helpers ────────────────────────────────────────────────────────

	private assertNotAborted(signal?: AbortSignal): void {
		if (signal?.aborted) throw new ServiceAbortError();
	}

	// ─── Core execution helpers ───────────────────────────────────────────────

	/**
	 * Safely acquires a Pixi app from the pool, runs `fn`, then releases it.
	 * Abort is checked both before queuing and after a potentially long pool wait.
	 */
	protected async useApp<T>(
		fn: (app: Application) => Promise<T>,
		signal?: AbortSignal,
	): Promise<T> {
		this.assertNotAborted(signal);

		return this.limit(async () => {
			// Re-check after potentially waiting in the concurrency queue.
			this.assertNotAborted(signal);

			const resource = await this.pool.acquire();
			try {
				this.cleanupStage(resource.app);
				return await fn(resource.app);
			} finally {
				this.cleanupStage(resource.app);
				this.pool.release(resource);
			}
		});
	}

	// ─── IPixiProcessor implementation ───────────────────────────────────────

	public async execute<TInput, TOutput>(
		_id: string,
		input: TInput,
		run: PixiRun,
		signal?: AbortSignal,
	): Promise<TOutput> {
		return this.useApp(async (app) => {
			const context: PixiRunContext = {
				app,
				loadTexture: (url, key) => this.loadTexture(url, key),
				getPixiModules: () => this.getPixiModules(),
				extractBlob: (target) => this.extractBlob(app.renderer, target),
				signal,
			};
			return run.run(context, input);
		}, signal);
	}

	public async processImage(
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
	): Promise<Blob> {
		return this.useApp(async (app) => {
			const [texture, modules] = await Promise.all([
				this.loadTexture(imageUrl, apiKey),
				this.getPixiModules(),
			]);
			const sprite = new modules.Sprite(texture);
			app.stage.addChild(sprite);
			await operations(app, sprite, modules);
			return this.extractBlob(app.renderer, app.stage);
		});
	}

	public async createTexture(url: string, apiKey?: string): Promise<Texture> {
		return this.loadTexture(url, apiKey);
	}

	public async extract(target: Container, renderer: IRenderer): Promise<Blob> {
		return this.extractBlob(renderer, target);
	}

	// ─── Lifecycle ────────────────────────────────────────────────────────────

	/**
	 * Drains and destroys the pool. Call during graceful shutdown to free all
	 * GPU/GL resources and prevent leaks on hot reload.
	 */
	public async shutdown(): Promise<void> {
		await this.pool.drain();
		await this.pool.clear();
	}
}
