import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DataType, prisma } from "@gatewai/db";
import {
	type OutputItem,
	VideoGenExtendNodeConfigSchema,
	type VideoGenResult,
} from "@gatewai/types";
import { ENV_CONFIG } from "../../config.js";
import { genAI } from "../../genai.js";
import { logger } from "../../logger.js";
import { generateSignedUrl, uploadToGCS } from "../../utils/storage.js";
import { getInputValue } from "../resolvers.js";
import type { NodeProcessor } from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const videoGenExtendProcessor: NodeProcessor = async ({ node, data }) => {
	try {
		const userPrompt = getInputValue(data, node.id, true, {
			dataType: DataType.Text,
			label: "Prompt",
		})?.data as string;

		const negativePrompt = getInputValue(data, node.id, false, {
			dataType: DataType.Text,
			label: "Negative Prompt",
		})?.data as string | undefined;

		const videoInputItem = getInputValue(data, node.id, true, {
			dataType: DataType.Video,
			label: "Video to extend",
		}) as OutputItem<"Video">;

		const videoInput = videoInputItem.data;
		const config = VideoGenExtendNodeConfigSchema.parse(node.config);

		let fileBlob: Blob;
		if (videoInput?.entity?.signedUrl) {
			fileBlob = await (await fetch(videoInput.entity?.signedUrl)).blob();
		} else if (videoInput?.processData?.dataUrl) {
			const buf = Buffer.from(videoInput?.processData?.dataUrl, "base64");
			fileBlob = new Blob([buf]);
		} else {
			return {
				success: false,
				error: "Input video data could not be resolved",
			};
		}

		const videoFile = await genAI.files.upload({
			file: fileBlob,
		});

		if (!videoFile.uri || !videoFile.mimeType) {
			return { success: false, error: "Uploaded audio data is corrupted." };
		}

		let operation = await genAI.models.generateVideos({
			model: config.model,
			prompt: userPrompt,
			video: {
				uri: videoFile.uri,
			},
			config: {
				negativePrompt,
			},
		});

		while (!operation.done) {
			logger.info("Waiting for video extension to complete...");
			await new Promise((resolve) => setTimeout(resolve, 10000));
			operation = await genAI.operations.getVideosOperation({
				operation: operation,
			});
		}

		if (!operation.response?.generatedVideos?.length) {
			throw new Error("No video generated from operation.");
		}

		const extension = ".mp4";
		const now = Date.now().toString();
		const folderPath = path.join(__dirname, `${node.id}_output`);
		const filePath = path.join(folderPath, `${now}${extension}`);

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
		const fileName = `videogen_extend_${randId}.${extension}`;
		const key = `assets/${fileName}`;
		const contentType = "video/mp4";
		const bucket = ENV_CONFIG.GCS_ASSETS_BUCKET;

		await uploadToGCS(fileBuffer, key, contentType, bucket);

		const expiresIn = 3600 * 24 * 7;
		const signedUrl = await generateSignedUrl(key, bucket, expiresIn);
		const signedUrlExp = new Date(Date.now() + expiresIn * 1000);

		const asset = await prisma.fileAsset.create({
			data: {
				name: fileName,
				bucket,
				size: fileBuffer.length,
				key,
				signedUrl,
				signedUrlExp,
				duration: Number(config.durationSeconds) * 1000,
				mimeType: contentType,
			},
		});

		// 9. Return Result
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
		console.error(err);
		if (err instanceof Error) {
			logger.error(`VideoGenExtend Error: ${err.message}`);
			return {
				success: false,
				error: err.message ?? "Video extension failed",
			};
		}
		return { success: false, error: "Video extension failed unknown error" };
	}
};

export default videoGenExtendProcessor;
