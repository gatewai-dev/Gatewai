import { randomUUID } from "node:crypto";
import os from "node:os";
import path from "node:path";
import type { IVideoRendererService, VideoRenderOptions } from "@gatewai/core";
import { logger } from "@gatewai/core";
import { injectable } from "inversify";

/**
 * Server-side video renderer backed by @remotion/renderer.
 *
 * Expects a pre-built Remotion bundle at the path specified by
 * `@gatewai/remotion-compositions` package's dist/remotion-bundle directory.
 *
 * The rendered file is written to a temp directory; callers are responsible
 * for uploading / moving the file afterwards.
 */
@injectable()
export class VideoRendererService implements IVideoRendererService {
	private bundlePath: string | null = null;

	private resolveBundlePath(): string {
		if (this.bundlePath) return this.bundlePath;

		try {
			const pkgPath = require.resolve(
				"@gatewai/remotion-compositions/package.json",
			);
			this.bundlePath = path.resolve(
				path.dirname(pkgPath),
				"dist",
				"remotion-bundle",
			);
		} catch {
			this.bundlePath = path.resolve(
				process.cwd(),
				"..", // out of apps/gatewai-backend
				"..", // out of apps
				"packages",
				"remotion-compositions",
				"dist",
				"remotion-bundle",
			);
		}

		return this.bundlePath;
	}

	async renderComposition(
		options: VideoRenderOptions,
	): Promise<{ filePath: string }> {
		// Dynamic import so @remotion/renderer is only loaded when rendering
		const { renderMedia, selectComposition } = await import(
			"@remotion/renderer"
		);

		const serveUrl = this.resolveBundlePath();

		logger.info(
			`[VideoRenderer] Starting render: ${options.compositionId} (${options.width}x${options.height} @ ${options.fps}fps)`,
		);
		console.log({ options });
		// Select the composition — this opens a headless browser to evaluate it
		const composition = await selectComposition({
			serveUrl,
			id: options.compositionId,
			inputProps: options.inputProps,
		});

		// Override composition metadata with caller-specified values
		composition.width = options.width;
		composition.height = options.height;
		composition.fps = options.fps;
		composition.durationInFrames = options.durationInFrames;

		// Convert startMS / endMS to frame range
		let frameRange: [number, number] | null = null;
		if (options.startMS != null || options.endMS != null) {
			const startFrame = options.startMS
				? Math.floor((options.startMS / 1000) * options.fps)
				: 0;
			const endFrame = options.endMS
				? Math.ceil((options.endMS / 1000) * options.fps) - 1
				: options.durationInFrames - 1;
			frameRange = [
				Math.max(0, startFrame),
				Math.min(endFrame, options.durationInFrames - 1),
			];
		}

		// Determine codec → file extension
		const codecExtMap: Record<string, string> = {
			h264: "mp4",
			h265: "mp4",
			vp8: "webm",
			vp9: "webm",
		};
		const codec = options.codec ?? "h264";
		const ext = codecExtMap[codec] ?? "mp4";

		// Output to temp directory
		const outputPath = path.join(
			os.tmpdir(),
			`gatewai-render-${randomUUID()}.${ext}`,
		);

		await renderMedia({
			composition,
			serveUrl,
			codec,
			outputLocation: outputPath,
			inputProps: options.inputProps,
			...(frameRange ? { frameRange } : {}),
			onProgress: options.onProgress,
		});

		logger.info(`[VideoRenderer] Render complete → ${outputPath}`);

		return { filePath: outputPath };
	}
}
