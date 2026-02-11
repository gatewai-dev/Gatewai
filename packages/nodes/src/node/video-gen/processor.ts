import assert from "node:assert";
import { existsSync, mkdirSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import path from "node:path";
import { generateId, logger } from "@gatewai/core";

import { DataType } from "@gatewai/db";
import type {
	BackendNodeProcessorCtx,
	BackendNodeProcessorResult,
	NodeProcessor,
} from "@gatewai/node-sdk";
import {
	type FileData,
	type VideoGenResult,
} from "@gatewai/types";
import { VideoGenNodeConfigSchema } from "../../configs/video-gen.config.js";
import type {
	GenerateVideosConfig,
	VideoGenerationReferenceImage,
	VideoGenerationReferenceType,
} from "@google/genai";
import { TOKENS } from "@gatewai/node-sdk";
import type { PrismaClient } from "@gatewai/db";
import type { EnvConfig } from "@gatewai/core";
import { inject, injectable } from "tsyringe";
import type {
	GraphResolvers,
	StorageService,
} from "@gatewai/node-sdk";
import { getGenAIClient } from "../genai.js";

@injectable()
export default class VideoGenProcessor implements NodeProcessor {
	constructor(
		@inject(TOKENS.PRISMA) private prisma: PrismaClient,
		@inject(TOKENS.GRAPH_RESOLVERS) private graph: GraphResolvers,
		@inject(TOKENS.STORAGE) private storage: StorageService,
		@inject(TOKENS.ENV) private env: EnvConfig,
	) { }

	async process({
		node,
		data,
	}: BackendNodeProcessorCtx): Promise<BackendNodeProcessorResult> {
		const genAI = getGenAIClient(this.env.GEMINI_API_KEY);
		try {
			const userPrompt = this.graph.getInputValue(data, node.id, true, {
				dataType: DataType.Text,
				label: "Prompt",
			})?.data as string;

			const negativePrompt = this.graph.getInputValue(data, node.id, false, {
				dataType: DataType.Text,
				label: "Negative Prompt",
			})?.data as string | undefined;

			const imageFileData = this.graph
				.getInputValuesByType(data, node.id, {
					dataType: DataType.Image,
				})
				.map((m) => m?.data) as FileData[] | null;

			const config = VideoGenNodeConfigSchema.parse(node.config);

			const LoadImageDataPromises = imageFileData?.map(async (fileData) => {
				const arrayBuffer = await this.graph.loadMediaBuffer(fileData);
				const buffer = Buffer.from(arrayBuffer);
				const base64Data = buffer.toString("base64");

				const mimeType = await this.graph.getFileDataMimeType(fileData);
				assert(mimeType);
				return {
					image: {
						imageBytes: base64Data,
						mimeType: mimeType,
					},
					// TODO: check if we can provide this as config
					referenceType: "ASSET" as VideoGenerationReferenceType,
				};
			});

			let referenceImages: VideoGenerationReferenceImage[] | undefined;

			if (LoadImageDataPromises) {
				referenceImages = await Promise.all(LoadImageDataPromises);
			}

			const noRefImages =
				referenceImages?.length == null || referenceImages?.length === 0;

			let operation = await genAI.models.generateVideos({
				model: config.model,
				prompt: userPrompt,
				config: {
					aspectRatio: referenceImages?.length ? "16:9" : config.aspectRatio,
					referenceImages: noRefImages ? undefined : referenceImages,
					numberOfVideos: 1,
					negativePrompt,
					personGeneration: referenceImages?.length
						? "allow_adult"
						: "allow_all",
					durationSeconds: Number(config.durationSeconds),
					resolution: config.resolution,
				},
			});

			while (!operation.done) {
				logger.info("Waiting for video generation to complete...");
				await new Promise((resolve) => setTimeout(resolve, 5000));
				operation = await genAI.operations.getVideosOperation({
					operation: operation,
				});
			}

			if (!operation.response?.generatedVideos) {
				throw new Error("No video is generated");
			}
			const extension = ".mp4";
			const now = Date.now().toString();
			const folderPath = path.join(process.cwd(), "temp", `${node.id}_output`);
			const filePath = path.join(folderPath, `${now}${extension}`);

			if (!operation.response.generatedVideos[0].video) {
				throw new Error("Generate video response is empty");
			}
			if (!existsSync(folderPath)) {
				mkdirSync(folderPath, { recursive: true });
			}

			await genAI.files.download({
				file: operation.response.generatedVideos[0].video,
				downloadPath: filePath,
			});

			const fileBuffer = await readFile(filePath);
			const randId = generateId();
			const fileName = `${node.name}_${randId}${extension}`;
			const key = `assets/${fileName}`;
			const contentType = "video/mp4";
			const bucket = this.env.GCS_ASSETS_BUCKET;
			await this.storage.uploadToGCS(fileBuffer, key, contentType, bucket);

			// Remove temp file
			try {
				await rm(folderPath, { recursive: true, force: true });
			} catch (cleanupErr) {
				const cleanupError =
					cleanupErr instanceof Error
						? cleanupErr
						: new Error(String(cleanupErr));
				logger.warn(
					`Failed to cleanup temp file: ${filePath}: ${cleanupError.message}`,
				);
			}

			const expiresIn = 3600 * 24 * 6.9;
			const signedUrl = await this.storage.generateSignedUrl(key, bucket, expiresIn);
			const signedUrlExp = new Date(Date.now() + expiresIn * 1000);

			const asset = await this.prisma.fileAsset.create({
				data: {
					name: fileName,
					userId: (data.canvas as unknown as { userId: string }).userId,
					bucket,
					key,
					size: fileBuffer.length,
					signedUrl,
					signedUrlExp,
					duration: Number(config.durationSeconds) * 1000,
					mimeType: contentType,
				},
			});

			const outputHandle = data.handles.find(
				(h) => h.nodeId === node.id && h.type === "Output",
			);
			if (!outputHandle) throw new Error("Output handle is missing");

			const newResult = structuredClone(
				node.result as unknown as VideoGenResult,
			) ?? {
				outputs: [],
				selectedOutputIndex: 0,
			};

			const newGeneration: VideoGenResult["outputs"][number] = {
				items: [
					{
						type: DataType.Video,
						data: { entity: asset },
						outputHandleId: outputHandle.id,
					},
				],
			};

			newResult.outputs.push(newGeneration);
			newResult.selectedOutputIndex = newResult.outputs.length - 1;

			return { success: true, newResult };
		} catch (err: unknown) {
			if (err instanceof Error) {
				logger.error(err.message);
				return {
					success: false,
					error: err?.message ?? "VideoGen processing failed",
				};
			}
			return { success: false, error: "VideoGen processing failed" };
		}
	}
}
