import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DataType, prisma } from "@gatewai/db";
import {
	type FileData,
	VideoGenNodeConfigSchema,
	type VideoGenResult,
} from "@gatewai/types";
import {
	type VideoGenerationReferenceImage,
	VideoGenerationReferenceType,
} from "@google/genai";
import { ENV_CONFIG } from "../../config.js";
import { genAI } from "../../genai.js";
import { logger } from "../../logger.js";
import {
	generateSignedUrl,
	getFromGCS,
	uploadToGCS,
} from "../../utils/storage.js";
import { getInputValue, getInputValuesByType } from "../resolvers.js";
import type { NodeProcessor } from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function ResolveImageData(fileData: FileData) {
	if (fileData.entity) {
		const buffer = await getFromGCS(
			fileData.entity.key,
			fileData.entity.bucket,
		);
		return buffer.toString("base64");
	}
	if (fileData.processData) {
		return fileData.processData.dataUrl;
	}
}

const videoGenProcessor: NodeProcessor = async ({ node, data }) => {
	try {
		const userPrompt = getInputValue(data, node.id, true, {
			dataType: DataType.Text,
			label: "Prompt",
		})?.data as string;

		const negativePrompt = getInputValue(data, node.id, false, {
			dataType: DataType.Text,
			label: "Negative Prompt",
		})?.data as string | undefined;

		const imageFileData = getInputValuesByType(data, node.id, {
			dataType: DataType.Image,
		}).map((m) => m?.data) as FileData[] | null;

		const config = VideoGenNodeConfigSchema.parse(node.config);

		const LoadImageDataPromises = imageFileData?.map(async (fileData) => {
			const base64Data = await ResolveImageData(fileData);
			const refImg: VideoGenerationReferenceImage = {
				image: {
					imageBytes: base64Data,
					mimeType: fileData.entity?.mimeType ?? "image/png",
				},
				referenceType: VideoGenerationReferenceType.ASSET,
			};
			return refImg;
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
				// If reference image exists, only 16:9 supported
				aspectRatio: referenceImages?.length ? "16:9" : config.aspectRatio,
				referenceImages: noRefImages ? undefined : referenceImages,
				numberOfVideos: 1,
				negativePrompt,
				personGeneration: referenceImages?.length ? "allow_adult" : "allow_all",
				durationSeconds: config.durationSeconds
					? Number(config.durationSeconds)
					: 8,
				resolution: config.resolution,
			},
		});

		while (!operation.done) {
			console.log("Waiting for video generation to complete...");
			await new Promise((resolve) => setTimeout(resolve, 10000));
			operation = await genAI.operations.getVideosOperation({
				operation: operation,
			});
		}

		if (!operation.response?.generatedVideos) {
			throw new Error("No video is generated");
		}
		const extension = ".mp4";
		const now = Date.now().toString();
		const folderPath = path.join(__dirname, `${node.id}_output`);
		const filePath = path.join(folderPath, `${now}${extension}`);
		// Download the video.
		if (!operation.response.generatedVideos[0].video) {
			throw new Error("Generate video response is empty");
		}
		if (!existsSync(folderPath)) {
			mkdirSync(folderPath);
		}

		await genAI.files.download({
			file: operation.response.generatedVideos[0].video,
			downloadPath: filePath,
		});

		const fileBuffer = await readFile(filePath);
		const randId = randomUUID();
		const fileName = `videogen_${randId}${extension}`;
		const key = `assets/${fileName}`;
		const contentType = "video/mp4";
		const bucket = ENV_CONFIG.GCS_ASSETS_BUCKET;
		await uploadToGCS(fileBuffer, key, contentType, bucket);

		const expiresIn = 3600 * 24 * 6.9; // A bit less than a week
		const signedUrl = await generateSignedUrl(key, bucket, expiresIn);
		const signedUrlExp = new Date(Date.now() + expiresIn * 1000);

		const asset = await prisma.fileAsset.create({
			data: {
				name: fileName,
				bucket,
				key,
				signedUrl,
				signedUrlExp,
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
		console.log(err);
		if (err instanceof Error) {
			logger.error(err.message);
			return {
				success: false,
				error: err?.message ?? "VideoGen processing failed",
			};
		}
		return { success: false, error: "VideoGen processing failed" };
	}
};

export default videoGenProcessor;
