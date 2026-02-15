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

export abstract class BasePixiService implements IPixiProcessor {
	protected pool: Pool<PixiResource>;
	// Limit concurrency to prevent GPU context loss or memory exhaustion
	protected limit = pLimit(12);
	private processors = new Map<string, PixiRun>();

	constructor() {
		this.pool = createPool(
			{
				create: async () => this.createResource(),
				destroy: async (resource: PixiResource) =>
					this.destroyResource(resource),
				validate: async (resource: PixiResource) =>
					this.validateResource(resource),
			},
			{
				max: 12, // Enough for frontend - may need to parameterize for backend when scaling
				min: 2,
				testOnBorrow: true,
			},
		);
	}

	public registerProcessor(processor: PixiRun) {
		this.processors.set(processor.id, processor);
	}

	protected abstract createApplication(): Application;
	protected abstract loadTexture(
		url: string,
		apiKey?: string,
	): Promise<Texture>;
	protected abstract getPixiImport(): string;

	/**
	 * Override this to provide Pixi modules.
	 * Allows separation of concerns between backend (dynamic imports) and frontend (static imports).
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

	protected abstract extractBlob(
		renderer: IRenderer,
		target: Container,
	): Promise<Blob>;

	private async createResource(): Promise<PixiResource> {
		const app = this.createApplication();
		return { app, id: Math.random().toString(36).substring(2, 9) };
	}

	private async destroyResource(resource: PixiResource): Promise<void> {
		// Destroying with true ensures context and GL resources are freed
		resource.app.destroy(true, {
			children: true,
			texture: true,
			baseTexture: true,
		});
	}

	private async validateResource(resource: PixiResource): Promise<boolean> {
		// Ensure renderer is still active and context isn't lost
		return !!resource.app.renderer;
	}

	/**
	 * Helper to safely acquire, use, and release a Pixi app.
	 * Handles stage cleanup to prevent memory leaks.
	 */
	protected async useApp<T>(
		fn: (app: Application) => Promise<T>,
		signal?: AbortSignal,
	): Promise<T> {
		return this.limit(async () => {
			this.ensureNotAborted(signal);

			const resource = await this.pool.acquire();
			try {
				// Safety clear before use
				this.cleanupStage(resource.app);
				return await fn(resource.app);
			} finally {
				// Thorough cleanup after use
				this.cleanupStage(resource.app);
				this.pool.release(resource);
			}
		});
	}

	/**
	 * Cleans the stage by removing and destroying children.
	 * Note: We set texture: false to avoid destroying cached textures managed by loadTexture.
	 */
	private cleanupStage(app: Application) {
		const children = app.stage.removeChildren();
		children.forEach((child) => {
			child.destroy({
				children: true,
				texture: false,
				baseTexture: false,
			});
		});
	}

	private ensureNotAborted(signal?: AbortSignal) {
		if (signal?.aborted) {
			throw new ServiceAbortError();
		}
	}

	public async execute<TInput, TOutput>(
		id: string,
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
			const texture = await this.loadTexture(imageUrl, apiKey);
			const modules = await this.getPixiModules();
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
}
