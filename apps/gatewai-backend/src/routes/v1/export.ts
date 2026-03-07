import { readFile, rm } from "node:fs/promises";
import {
	ENV_CONFIG,
	type EnvConfig,
	type IMediaRendererService,
	logger,
} from "@gatewai/core";
import { container, TOKENS } from "@gatewai/core/di";
import type { StorageService } from "@gatewai/core/storage";
import type { VirtualMediaData } from "@gatewai/core/types";
import { prisma } from "@gatewai/db";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";
import type { AuthorizedHonoTypes } from "../../auth.js";
import { PricingService } from "../../lib/pricing.service.js";

const RENDER_COST = 10;

const renderExportSchema = z.object({
	canvasId: z.string(),
	nodeId: z.string(),
	data: z.any(),
	type: z.enum(["Video", "Audio"]),
});

const exportRouter = new Hono<{ Variables: AuthorizedHonoTypes }>({
	strict: false,
}).post("/render", zValidator("json", renderExportSchema), async (c) => {
	const { canvasId, nodeId, data, type } = c.req.valid("json");
	const userId = c.get("userId");

	const canAfford = await new PricingService(
		await container.get(TOKENS.PRISMA),
	).canAfford(userId, RENDER_COST);

	if (!canAfford) {
		return c.json(
			{ error: `Insufficient tokens. Required: ${RENDER_COST}` },
			402,
		);
	}

	const virtualMedia = data as VirtualMediaData;

	if (
		!virtualMedia.metadata.width ||
		!virtualMedia.metadata.height ||
		!virtualMedia.metadata.fps ||
		!virtualMedia.metadata.durationMs
	) {
		return c.json(
			{
				error:
					"VirtualMediaData must have width, height, fps and durationInFrames",
			},
			400,
		);
	}

	const env = container.get<EnvConfig>(TOKENS.ENV);
	const rendererService = container.get<IMediaRendererService>(
		TOKENS.MEDIA_RENDERER,
	);
	const storage = container.get<StorageService>(TOKENS.STORAGE);
	const prismaClient = container.get(TOKENS.PRISMA);

	let renderedVideo: { filePath: string } | undefined;
	try {
		renderedVideo = await rendererService.renderComposition({
			compositionId: "CompositionScene",
			inputProps: {
				virtualMedia,
				viewportWidth: virtualMedia.metadata.width,
				viewportHeight: virtualMedia.metadata.height,
				type,
			},
			width: virtualMedia.metadata.width,
			height: virtualMedia.metadata.height,
			fps: virtualMedia.metadata.fps,
			durationInFrames:
				(virtualMedia.metadata.durationMs / 1000) * virtualMedia.metadata.fps,
			envVariables: {
				VITE_BASE_URL: env.BASE_URL,
			},
		});
	} catch (error) {
		logger.error({ errorW: error });
		return c.json({ error: "Failed to render video" }, 500);
	}

	if (!renderedVideo) {
		return c.json({ error: "Render produced no output" }, 500);
	}

	logger.info(`Rendered video: ${renderedVideo.filePath}`);
	const contentType = type === "Video" ? "video/mp4" : "audio/mp3";
	const fileBuffer = await readFile(renderedVideo.filePath);

	const fileName = `render-export-${nodeId}-${Date.now()}.${
		type === "Video" ? "mp4" : "mp3"
	}`;
	const key = `assets/exports/${userId}/${fileName}`;

	await storage.uploadToStorage(
		fileBuffer,
		key,
		contentType,
		env.GCS_ASSETS_BUCKET,
	);

	try {
		await rm(renderedVideo.filePath, { force: true });
	} catch (cleanupErr) {
		logger.warn(`Failed to cleanup temp file: ${renderedVideo.filePath}`);
	}

	const fps = virtualMedia.metadata.fps ?? 30;
	const durationMs = virtualMedia.metadata.durationMs ?? 1000;

	const asset = await prismaClient.fileAsset.create({
		data: {
			name: fileName,
			userId,
			bucket: env.GCS_ASSETS_BUCKET,
			key,
			size: fileBuffer.length,
			width: virtualMedia.metadata.width ?? 1920,
			height: virtualMedia.metadata.height ?? 1080,
			fps,
			duration: durationMs,
			mimeType: contentType,
		},
	});

	await new PricingService(prismaClient).deductTokens(
		userId,
		RENDER_COST,
		`export_render_${nodeId}_${Date.now()}`,
	);

	return c.json({
		assetId: asset.id,
		fileUrl: `${env.BASE_URL}/v1/assets/${asset.id}`,
		mimeType: contentType,
	});
});

export { exportRouter };
