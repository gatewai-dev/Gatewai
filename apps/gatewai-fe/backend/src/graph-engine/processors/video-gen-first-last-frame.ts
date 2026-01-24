import assert from "node:assert";
import { existsSync, mkdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DataType, prisma } from "@gatewai/db";
import {
	type FileData,
	type OutputItem,
	VideoGenFirstLastFrameNodeConfigSchema,
	type VideoGenResult,
} from "@gatewai/types";
import { ENV_CONFIG } from "../../config.js";
import { genAI } from "../../genai.js";
import { logger } from "../../logger.js";
import { generateId } from "../../utils/misc.js";
import { generateSignedUrl, uploadToGCS } from "../../utils/storage.js";
import {
	getFileDataMimeType,
	getInputValue,
	loadMediaBuffer,
} from "../resolvers.js";
import type { NodeProcessor } from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function ResolveImageData(fileData: FileData) {
	const arrayBuffer = await loadMediaBuffer(fileData);
	const buffer = Buffer.from(arrayBuffer);
	const base64Data = buffer.toString("base64");

	const mimeType = await getFileDataMimeType(fileData);
	assert(mimeType);
	return { base64Data, mimeType };
}

const videoGenFirstLastFrameProcessor: NodeProcessor = async ({
	node,
	data,
}) => {
	try {
		const userPrompt = getInputValue(data, node.id, true, {
			dataType: DataType.Text,
			label: "Prompt",
		})?.data as string;

		const firstFrameInput = getInputValue(data, node.id, true, {
			dataType: DataType.Image,
			label: "First Frame",
		}) as OutputItem<"Image">;

		const lastFrameInput = getInputValue(data, node.id, true, {
			dataType: DataType.Image,
			label: "Last Frame",
		}) as OutputItem<"Image">;

		if (!firstFrameInput || !lastFrameInput) {
			throw new Error("Missing data for First or Last frame.");
		}

		const firstFileData = firstFrameInput.data as FileData;
		const lastFileData = lastFrameInput.data as FileData;

		// 3. Parse Configuration
		const config = VideoGenFirstLastFrameNodeConfigSchema.parse(node.config);

		// 4. Resolve Images to Base64
		const [
			{ base64Data: firstBase64, mimeType: firstMimeType },
			{ base64Data: lastBase64, mimeType: lastMimeType },
		] = await Promise.all([
			ResolveImageData(firstFileData),
			ResolveImageData(lastFileData),
		]);

		// 5. Call Google GenAI (Veo)
		// Note: 'image' param is the start frame. 'lastFrame' goes into the config object.
		// See API Docs for Veo 3.1 interpolation
		let operation = await genAI.models.generateVideos({
			model: config.model,
			prompt: userPrompt,
			image: {
				imageBytes: firstBase64,
				mimeType: firstMimeType,
			},
			config: {
				lastFrame: {
					imageBytes: lastBase64,
					mimeType: lastMimeType,
				},
				resolution: config.resolution,
				personGeneration: config.personGeneration,
				durationSeconds: Number(config.durationSeconds),
			},
		});

		while (!operation.done) {
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
		const randId = generateId();
		const fileName = `videogen_interp_${randId}.${extension}`;
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
			logger.error(`VideoGenFirstLastFrame Error: ${err.message}`);
			return {
				success: false,
				error: err.message ?? "Video interpolation failed",
			};
		}
		return {
			success: false,
			error: "Video interpolation failed unknown error",
		};
	}
};

export default videoGenFirstLastFrameProcessor;
