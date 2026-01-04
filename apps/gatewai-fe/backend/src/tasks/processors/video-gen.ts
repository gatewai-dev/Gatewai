import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DataType, prisma } from "@gatewai/db";
import { type FileData, type VideoGenNodeConfig, VideoGenNodeConfigSchema, type VideoGenResult } from "@gatewai/types";
import type { VideoGenerationReferenceImage } from "@google/genai";
import { ENV_CONFIG } from "../../config.js";
import { genAI } from "../../genai.js";
import { logger } from "../../logger.js";
import { generateSignedUrl, uploadToS3 } from "../../utils/storage.js";
import { getInputValue, getInputValuesByType } from "../resolvers.js";
import type { NodeProcessor } from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const videoGenProcessor: NodeProcessor = async ({ node, data }) => {
	try {

		const userPrompt = getInputValue(data, node.id, true, {
			dataType: DataType.Text,
			label: "Prompt",
		})?.data as string;

		const imageFileData = getInputValuesByType(data, node.id, {
			dataType: DataType.Image,
		}).map((m) => m?.data) as FileData[] | null;

		const nodeConfig = VideoGenNodeConfigSchema.parse(node.config);
		let operation = await genAI.models.generateVideos({
			model: nodeConfig.model,
			prompt: userPrompt,
			config: {
				referenceImages: 
			}
		})

		while (!operation.done) {
		  console.log("Waiting for video generation to complete...")
		  await new Promise((resolve) => setTimeout(resolve, 10000));
		  operation = await genAI.operations.getVideosOperation({
		    operation: operation,
		  });
		}

		if (!operation.response?.generatedVideos) {
			throw new Error("No video is generated");
		}
		// Download the video.
		genAI.files.download({
		    file: operation.response.generatedVideos[0].video,
		    downloadPath: "veo3_with_image_input.mp4",
		});

		const extension = "mp4";
		const testPath = path.join(__dirname, "test-vid.mp4");
		const fileBuffer = await readFile(testPath);
		const randId = randomUUID();
		const fileName = `videogen_${randId}.${extension}`;
		const key = `assets/${data.canvas.userId}/${fileName}`;
		const contentType = "video/mp4";
		const bucket = ENV_CONFIG.AWS_ASSETS_BUCKET;
		await uploadToS3(fileBuffer, key, contentType, bucket);

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
				userId: data.canvas.userId,
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
