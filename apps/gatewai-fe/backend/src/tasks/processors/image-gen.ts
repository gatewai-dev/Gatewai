import { DataType, prisma } from "@gatewai/db";
import type { FileData, ImageGenConfig, ImageGenResult } from "@gatewai/types";
import type { NodeProcessor } from "./types.js";
import {
	generateText,
	type ModelMessage,
	type TextPart,
	type UserContent,
} from "ai";
import { generateSignedUrl, uploadToS3 } from "../../utils/s3.js";
import { getImageDimensions } from "../../utils/image.js";
import { randomUUID } from "crypto";
import { getInputValue, getInputValuesByType } from "../resolvers.js";

const imageGenProcessor: NodeProcessor = async ({ node, data }) => {
	try {
		const userPrompt = getInputValue(data, node.id, true, {
			dataType: DataType.Text,
			label: "Prompt",
		}) as string;
		const imageFileData = getInputValuesByType(data, node.id, {
			dataType: DataType.Image,
		}) as FileData[] | null;

		// Build messages
		const messages: ModelMessage[] = [];
		// IF USER DOESN'T PROVIDE PROMPT THAT REQUEST IMAGE, STILL FORCE TO GENERATE IMAGE
		messages.push({
			role: "system",
			content:
				"Generate Image with user's request. WHATEVER entered, you must generate image.",
		});

		const userContent: UserContent = [];

		if (userPrompt) {
			const textPart: TextPart = {
				type: "text",
				text: userPrompt,
			};
			userContent.push(textPart);
		}

		for (const imgData of imageFileData || []) {
			const imageData = imgData?.entity?.signedUrl ?? imgData?.dataUrl;
			if (imageData) {
				userContent.push({ type: "image", image: imageData });
			}
		}

		if (userContent.length === 0) {
			return { success: false, error: "No user prompt or image provided" };
		}

		messages.push({
			role: "user",
			content:
				userContent.length === 1 && typeof userContent[0] === "string"
					? (userContent[0] as string)
					: userContent,
		});

		const config = node.config as ImageGenConfig;

		const result = await generateText({
			model: config.model ?? "google/gemini-2.5-flash-image",
			messages,
		});

		const imageFiles = result.files.filter((f) =>
			f.mediaType?.startsWith("image/"),
		);

		if (imageFiles.length === 0) {
			return { success: false, error: "No images generated" };
		}

		const file = imageFiles[0];

		const extension = file.mediaType?.split("/")[1] || "png";

		const buffer = Buffer.from(file.uint8Array.buffer);
		const dimensions = await getImageDimensions(buffer);
		const randId = randomUUID();
		const fileName = `imagegen_${randId}.${extension}`;
		const key = `assets/${data.canvas.userId}/${fileName}`;
		const contentType = file.mediaType;
		const bucket = process.env.AWS_ASSETS_BUCKET!;
		await uploadToS3(buffer, key, contentType, bucket);

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
				...dimensions,
				mimeType: contentType,
			},
		});

		const outputHandle = data.handles.find(
			(h) => h.nodeId === node.id && h.type === "Output",
		);
		if (!outputHandle) throw new Error("Output handle is missing");

		const newResult = structuredClone(
			node.result as unknown as ImageGenResult,
		) ?? {
			outputs: [],
			selectedOutputIndex: 0,
		};

		const newGeneration: ImageGenResult["outputs"][number] = {
			items: [
				{
					type: DataType.Image,
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
			return {
				success: false,
				error: err?.message ?? "ImageGen processing failed",
			};
		}
		return { success: false, error: "ImageGen processing failed" };
	}
};

export default imageGenProcessor;
