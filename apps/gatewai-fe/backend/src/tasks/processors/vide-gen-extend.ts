import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DataType, prisma } from "@gatewai/db";
import type { VideoGenExtendResult } from "@gatewai/types";
import { ENV_CONFIG } from "../../config.js";
import { logger } from "../../logger.js";
import { generateSignedUrl, uploadToS3 } from "../../utils/s3.js";
import type { NodeProcessor } from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const videoGenExtendProcessor: NodeProcessor = async ({ node, data }) => {
	try {
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
			node.result as unknown as VideoGenExtendResult,
		) ?? {
			outputs: [],
			selectedOutputIndex: 0,
		};

		const newGeneration: VideoGenExtendResult["outputs"][number] = {
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

export default videoGenExtendProcessor;
