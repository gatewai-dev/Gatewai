import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DataType, prisma } from "@gatewai/db";
import {
	type FileData,
	type OutputItem,
	VideoGenExtendNodeConfigSchema,
	type VideoGenResult,
} from "@gatewai/types";
import { ENV_CONFIG } from "../../config.js";
import { genAI } from "../../genai.js";
import { logger } from "../../logger.js";
import {
	generateSignedUrl,
	getFromS3,
	uploadToS3,
} from "../../utils/storage.js";
import { getInputValue } from "../resolvers.js";
import type { NodeProcessor } from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function ResolveVideoData(fileData: FileData) {
	if (fileData.entity) {
		const buffer = await getFromS3(fileData.entity.key, fileData.entity.bucket);
		return buffer.toString("base64").replace(/^data:video\/\w+;base64,/, "");
	}
	if (fileData.processData?.dataUrl) {
		// STRIP PREFIX: Strips common video data URL headers
		return fileData.processData.dataUrl.replace(/^data:video\/\w+;base64,/, "");
	}
	throw new Error("Unable to resolve video data");
}

const videoGenExtendProcessor: NodeProcessor = async ({ node, data }) => {
	try {
		// 1. Fetch Text Prompt
		const userPrompt = getInputValue(data, node.id, true, {
			dataType: DataType.Text,
			label: "Prompt",
		})?.data as string;

		const negativePrompt = getInputValue(data, node.id, false, {
			dataType: DataType.Text,
			label: "Negative Prompt",
		})?.data as string | undefined;

		const videoInput = getInputValue(data, node.id, true, {
			dataType: DataType.Video,
			label: "Video to extend",
		}) as OutputItem<"Video">;

		// 3. Parse Configuration
		const config = VideoGenExtendNodeConfigSchema.parse(node.config);

		// 4. Resolve Video to Base64
		const videoBase64 = await ResolveVideoData(videoInput.data);

		// 5. Call Google GenAI (Veo)
		// For extension, we pass the video in the 'video' field of the request
		let operation = await genAI.models.generateVideos({
			model: config.model,
			prompt: userPrompt,
			video: {
				videoBytes: videoBase64,
				mimeType: videoInput.data.entity?.mimeType ?? "video/mp4",
			},
			config: {
				resolution: "720p",
				numberOfVideos: 1,
				negativePrompt,
			},
		});

		// 6. Polling
		while (!operation.done) {
			console.log("Waiting for video extension to complete...");
			await new Promise((resolve) => setTimeout(resolve, 10000));
			operation = await genAI.operations.getVideosOperation({
				operation: operation,
			});
		}

		if (!operation.response?.generatedVideos?.length) {
			throw new Error("No video generated from operation.");
		}

		// 7. Download and Process Result
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

		// 8. Upload to Storage (S3/GCS) & DB Record
		const fileBuffer = await readFile(filePath);
		const randId = randomUUID();
		const fileName = `videogen_extend_${randId}.${extension}`;
		const key = `assets/${fileName}`;
		const contentType = "video/mp4";
		const bucket = ENV_CONFIG.GCS_ASSETS_BUCKET;

		await uploadToS3(fileBuffer, key, contentType, bucket);

		const expiresIn = 3600 * 24 * 7;
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
