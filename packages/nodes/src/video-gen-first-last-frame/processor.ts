import assert from "node:assert";
import { existsSync, mkdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { genAI, logger } from "@gatewai/core";
import { DataType } from "@gatewai/db";
import type { BackendNodeProcessor } from "@gatewai/node-sdk";
import {
	type FileData,
	type OutputItem,
	VideoGenFirstLastFrameNodeConfigSchema,
	type VideoGenResult,
} from "@gatewai/types";

async function ResolveImageData(
	fileData: FileData,
	services: {
		loadMediaBuffer: (fd: FileData) => Promise<Buffer>;
		getFileDataMimeType: (fd: FileData) => Promise<string | null>;
	},
) {
	const arrayBuffer = await services.loadMediaBuffer(fileData);
	const buffer = Buffer.from(arrayBuffer);
	const base64Data = buffer.toString("base64");

	const mimeType = await services.getFileDataMimeType(fileData);
	assert(mimeType);
	return { base64Data, mimeType };
}

const videoGenFirstLastFrameProcessor: BackendNodeProcessor = async ({
	node,
	data,
	prisma,
	services,
}) => {
	try {
		const userPrompt = services.getInputValue(data, node.id, true, {
			dataType: DataType.Text,
			label: "Prompt",
		})?.data as string;

		const firstFrameInput = services.getInputValue(data, node.id, true, {
			dataType: DataType.Image,
			label: "First Frame",
		}) as OutputItem<"Image">;

		const lastFrameInput = services.getInputValue(data, node.id, true, {
			dataType: DataType.Image,
			label: "Last Frame",
		}) as OutputItem<"Image">;

		if (!firstFrameInput || !lastFrameInput) {
			throw new Error("Missing data for First or Last frame.");
		}

		const firstFileData = firstFrameInput.data as FileData;
		const lastFileData = lastFrameInput.data as FileData;

		const config = VideoGenFirstLastFrameNodeConfigSchema.parse(node.config);

		const [
			{ base64Data: firstBase64, mimeType: firstMimeType },
			{ base64Data: lastBase64, mimeType: lastMimeType },
		] = await Promise.all([
			ResolveImageData(firstFileData, services),
			ResolveImageData(lastFileData, services),
		]);

		let operation = (await genAI.models.generateVideos({
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
		})) as {
			done?: boolean;
			response?: { generatedVideos?: Array<{ video?: unknown }> };
		};

		while (!operation.done) {
			await new Promise((resolve) => setTimeout(resolve, 10000));
			operation = (await genAI.operations.getVideosOperation({
				operation: operation as any,
			})) as typeof operation;
		}

		if (!operation.response?.generatedVideos?.length) {
			throw new Error("No video generated from operation.");
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
		const randId = services.generateId();
		const fileName = `${node.name}_${randId}.${extension}`;
		const key = `assets/${fileName}`;
		const contentType = "video/mp4";
		const bucket = services.env.GCS_ASSETS_BUCKET;

		await services.uploadToGCS(fileBuffer, key, contentType, bucket);

		const expiresIn = 3600 * 24 * 7;
		const signedUrl = await services.generateSignedUrl(key, bucket, expiresIn);
		const signedUrlExp = new Date(Date.now() + expiresIn * 1000);

		const asset = await prisma.fileAsset.create({
			data: {
				name: fileName,
				userId: (data.canvas as unknown as { userId: string }).userId,
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
