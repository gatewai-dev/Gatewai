import { existsSync, mkdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { DataType } from "@gatewai/db";
import type { BackendNodeProcessor } from "@gatewai/node-sdk";
import {
	type OutputItem,
	VideoGenExtendNodeConfigSchema,
	type VideoGenResult,
} from "@gatewai/types";

const videoGenExtendProcessor: BackendNodeProcessor = async ({
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

		const negativePrompt = services.getInputValue(data, node.id, false, {
			dataType: DataType.Text,
			label: "Negative Prompt",
		})?.data as string | undefined;

		const videoInputItem = services.getInputValue(data, node.id, true, {
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

		const videoFile = (await services.genAI.files.upload({
			file: fileBlob,
		})) as { uri?: string; mimeType?: string };

		if (!videoFile.uri || !videoFile.mimeType) {
			return { success: false, error: "Uploaded audio data is corrupted." };
		}

		let operation = (await services.genAI.models.generateVideos({
			model: config.model,
			prompt: userPrompt,
			video: {
				uri: videoFile.uri,
			},
			config: {
				negativePrompt,
			},
		})) as {
			done?: boolean;
			response?: { generatedVideos?: Array<{ video?: unknown }> };
		};

		while (!operation.done) {
			services.logger.info("Waiting for video extension to complete...");
			await new Promise((resolve) => setTimeout(resolve, 10000));
			operation = (await services.genAI.operations.getVideosOperation({
				operation: operation,
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

		await services.genAI.files.download({
			file: operation.response.generatedVideos[0].video,
			downloadPath: filePath,
		});

		const fileBuffer = await readFile(filePath);
		const randId = services.generateId();
		const fileName = `videogen_extend_${randId}.${extension}`;
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
			services.logger.error(`VideoGenExtend Error: ${err.message}`);
			return {
				success: false,
				error: err.message ?? "Video extension failed",
			};
		}
		return { success: false, error: "Video extension failed unknown error" };
	}
};

export default videoGenExtendProcessor;
