import { exec } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DataType, type FileAssetCreateInput, prisma } from "@gatewai/db";
import {
	type FileData,
	VideoCompositorNodeConfigSchema,
	type VideoCompositorResult,
} from "@gatewai/types";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { ENV_CONFIG } from "../../../config.js";
import { logger } from "../../../logger.js";
import { generateSignedUrl, uploadToGCS } from "../../../utils/storage.js";
import { getAllInputValuesWithHandle } from "../../resolvers.js";
import type { NodeProcessor } from "./../types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function getMediaDuration(fileData: FileData): Promise<number> {
	return fileData?.entity?.duration ?? fileData.processData?.duration ?? 0;
}

const videoCompositorProcessor: NodeProcessor = async ({ node, data }) => {
	let tempDir: string | undefined;
	try {
		const config = VideoCompositorNodeConfigSchema.parse(node.config);
		const inputs = getAllInputValuesWithHandle(data, node.id);

		const width = config.width ?? 1280;
		const height = config.height ?? 720;
		const fps = config.FPS ?? 24;

		// Compute durationInFrames (mirrors logic from RemotionWebProcessorService)
		const layers = Object.values(config.layerUpdates ?? {});

		const effectiveLayers: {
			layer: (typeof layers)[0];
			durFrames: number;
			startFrame: number;
		}[] = [];

		const mediaDurationPromises: Promise<{
			inputHandleId: string;
			durFrames: number;
		}>[] = [];

		for (const layer of layers) {
			const input = inputs.find((f) => f.handle?.id === layer.inputHandleId);
			if (!input) continue;

			const startFrame = layer.startFrame ?? 0;
			let durFrames: number | undefined;

			if (layer.durationInFrames != null) {
				durFrames = layer.durationInFrames;
			} else if (layer.duration != null) {
				durFrames = Math.floor(layer.duration * fps);
			} else if (
				input.value?.type === "Video" ||
				input.value?.type === "Audio"
			) {
				const promise = getMediaDuration(input.value.data as FileData).then(
					(durSec) => ({
						inputHandleId: layer.inputHandleId,
						durFrames: Math.floor(durSec * fps),
					}),
				);
				mediaDurationPromises.push(promise);
				continue; // Defer to promise resolution
			} else {
				// Text/Image layers span the full duration; skip for max calculation
				continue;
			}

			effectiveLayers.push({ layer, durFrames, startFrame });
		}

		if (mediaDurationPromises.length > 0) {
			const mediaDurs = await Promise.all(mediaDurationPromises);
			for (const md of mediaDurs) {
				const layer = layers.find((l) => l.inputHandleId === md.inputHandleId);
				if (layer) {
					const startFrame = layer.startFrame ?? 0;
					effectiveLayers.push({
						layer,
						durFrames: md.durFrames,
						startFrame,
					});
				}
			}
		}

		let maxEndFrame = 0;
		for (const el of effectiveLayers) {
			const end = el.startFrame + (el.durFrames ?? 0);
			maxEndFrame = Math.max(maxEndFrame, end);
		}

		const durationInFrames = maxEndFrame || fps; // Default to 1 second if no computable duration
		if (durationInFrames <= 0) {
			return { success: false, error: "Unable to compute valid duration" };
		}

		// Create temporary directory for bundle and output
		tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "remotion-"));

		// Assume a fixed entry point in the project that exports the composition with DynamicComposition
		// and uses calculateMetadata to pull from props.preComputedDurationInFrames, etc.
		const entryPoint = path.resolve(__dirname, "../remotion/entry.jsx");
		const bundleLocation = await bundle({ entryPoint });

		const inputProps = {
			config,
			inputs,
			preComputedDurationInFrames: durationInFrames,
			width,
			height,
			fps,
		};

		const composition = await selectComposition({
			serveUrl: bundleLocation,
			id: "dynamic-video",
			inputProps,
		});

		const outputLocation = path.join(tempDir, "output.mp4");

		await renderMedia({
			composition,
			serveUrl: bundleLocation,
			codec: "h264",
			outputLocation,
			inputProps,
			onProgress: ({ progress }) => {
				logger.info(`Rendering progress: ${progress} %)`);
			},
			// Additional options: concurrency, crf, etc., can be tuned for performance/quality
		});

		const buffer = await fs.readFile(outputLocation);

		// Upload to GCS
		const extension = "mp4";
		const contentType = "video/mp4";
		const randId = randomUUID();
		const fileName = `videocomp_${randId}.${extension}`;
		const key = `assets/${fileName}`;
		const bucket = ENV_CONFIG.GCS_ASSETS_BUCKET;

		await uploadToGCS(buffer, key, contentType, bucket);

		const expiresIn = 3600 * 24 * 6.9; // ~1 week
		const signedUrl = await generateSignedUrl(key, bucket, expiresIn);
		const signedUrlExp = new Date(Date.now() + expiresIn * 1000);

		const dimensions = { width, height };
		const duration = durationInFrames / fps;

		const asset: FileAssetCreateInput = {
			name: fileName,
			bucket,
			key,
			signedUrl,
			signedUrlExp,
			...dimensions,
			duration,
			mimeType: contentType,
			isUploaded: false,
			fps,
		};

		const createdAsset = await prisma.fileAsset.create({ data: asset });

		// Prepare new result
		const outputHandle = data.handles.find(
			(h) => h.nodeId === node.id && h.type === "Output",
		);
		if (!outputHandle) {
			return { success: false, error: "Output handle is missing" };
		}

		const newResult = structuredClone(
			node.result as unknown as VideoCompositorResult,
		) ?? {
			outputs: [],
			selectedOutputIndex: 0,
		};

		const newGeneration: VideoCompositorResult["outputs"][number] = {
			items: [
				{
					type: DataType.Video,
					data: { entity: createdAsset },
					outputHandleId: outputHandle.id,
				},
			],
		};

		newResult.outputs.push(newGeneration);

		return { success: true, newResult };
	} catch (err: unknown) {
		logger.error("VideoCompositor processing failed");
		logger.error(err);
		return {
			success: false,
			error: err instanceof Error ? err.message : "Unknown error",
		};
	} finally {
		if (tempDir) {
			await fs
				.rm(tempDir, { recursive: true, force: true })
				.catch((cleanupErr) => {
					logger.warn("Failed to clean up temp dir");
					logger.warn(cleanupErr);
				});
		}
	}
};

export default videoCompositorProcessor;
