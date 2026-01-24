import assert from "node:assert";
import { DataType, prisma } from "@gatewai/db";
import {
	type FileData,
	ImageGenNodeConfigSchema,
	type ImageGenResult,
} from "@gatewai/types";
import type { Part } from "@google/genai";
import { ENV_CONFIG } from "../../config.js";
import { genAI } from "../../genai.js";
import { logger } from "../../logger.js";
import { getImageDimensions } from "../../utils/image.js";
import { generateId } from "../../utils/misc.js";
import {
	generateSignedUrl,
	getFromGCS,
	uploadToGCS,
} from "../../utils/storage.js";
import { getInputValue, getInputValuesByType } from "../resolvers.js";
import type { NodeProcessor } from "./types.js";

const imageGenProcessor: NodeProcessor = async ({ node, data }) => {
	try {
		const userPrompt = getInputValue(data, node.id, true, {
			dataType: DataType.Text,
			label: "Prompt",
		})?.data as string;

		const imageFileData = getInputValuesByType(data, node.id, {
			dataType: DataType.Image,
		}).map((m) => m?.data) as FileData[] | null;

		// 1. Prepare Parts for the Model
		const parts: Part[] = [];

		logger.debug(`User prompt: ${userPrompt}`);
		if (userPrompt) {
			parts.push({ text: userPrompt });
		}

		logger.info(`Number of reference images: ${imageFileData?.length ?? 0}`);

		// Convert reference images to inlineData for Google SDK
		for (const imgData of imageFileData || []) {
			if (!imgData) {
				continue;
			}

			let mimeType: string | undefined;
			let key: string | undefined;
			let bucket: string | undefined;

			if (imgData.entity) {
				key = imgData.entity.key;
				bucket = imgData.entity.bucket;
				mimeType = imgData.entity.mimeType;
			} else if (imgData.processData) {
				key = imgData.processData.tempKey;
				mimeType = imgData.processData.mimeType;
				bucket = undefined;
			} else {
				logger.warn("Skipping image: Image data could not be found");
				continue;
			}

			assert(key, "Key must be defined for image retrieval");
			assert(mimeType, "MimeType must be defined for image retrieval");

			const arrayBuffer = await getFromGCS(key, bucket);
			const buffer = Buffer.from(arrayBuffer);
			const base64Data = buffer.toString("base64");

			parts.push({
				inlineData: { mimeType, data: base64Data },
			});
		}

		if (parts.length === 0) {
			return { success: false, error: "No user prompt or image provided" };
		}

		const config = ImageGenNodeConfigSchema.parse(node.config);

		// 2. Execute Image Generation using generateContent
		const response = await genAI.models.generateContent({
			model: config.model,
			contents: [
				{
					role: "user",
					parts: parts,
				},
			],

			config: {
				responseModalities: ["IMAGE"],
				systemInstruction: [
					"You are a image generator.",
					"Your mission is to create an image whether prompt tells you to or not.",
				],
				imageConfig:
					config.model === "gemini-3-pro-image-preview"
						? {
								aspectRatio: config.aspectRatio,
								imageSize: config.imageSize,
							}
						: undefined,
			},
		});

		// 3. Process the Result
		// We look for the first part containing inlineData (the generated image)
		const candidate = response.candidates?.[0];
		const contentParts = candidate?.content?.parts;
		const imagePart = contentParts?.find((part) => part.inlineData);

		if (!imagePart || !imagePart.inlineData || !imagePart.inlineData.data) {
			// Check if there's a text refusal/error message in the response
			const textPart = contentParts?.find((part) => part.text)?.text;
			if (textPart) {
				return {
					success: false,
					error: `Model returned text instead of image: ${textPart}`,
				};
			}
			return { success: false, error: "No image generated" };
		}

		const mimeType = imagePart.inlineData.mimeType ?? "image/png";
		const buffer = Buffer.from(imagePart.inlineData.data, "base64");

		// Determine extension based on mimeType
		let extension = "png";
		if (mimeType.includes("jpeg") || mimeType.includes("jpg"))
			extension = "jpg";
		else if (mimeType.includes("webp")) extension = "webp";

		const contentType = mimeType;

		const dimensions = await getImageDimensions(buffer);
		const randId = generateId();
		const fileName = `imagegen_${randId}.${extension}`;
		const key = `assets/${fileName}`;
		const bucket = ENV_CONFIG.GCS_ASSETS_BUCKET;

		await uploadToGCS(buffer, key, contentType, bucket);
		const size = buffer.length;

		const expiresIn = 3600 * 24 * 6.9;
		const signedUrl = await generateSignedUrl(key, bucket, expiresIn);
		const signedUrlExp = new Date(Date.now() + expiresIn * 1000);

		const asset = await prisma.fileAsset.create({
			data: {
				name: fileName,
				bucket,
				key,
				size,
				signedUrl,
				signedUrlExp,
				...dimensions,
				mimeType: contentType,
			},
		});

		const outputHandle = data.handles.find(
			(h) => h.nodeId === node.id && h.type === "Output",
		);
		if (!outputHandle)
			return { success: false, error: "Output handle is missing." };

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
		console.error(err);
		if (err instanceof Error) {
			logger.error(err.message);
			return {
				success: false,
				error: err.message ?? "ImageGen processing failed",
			};
		}
		return { success: false, error: "ImageGen processing failed" };
	}
};

export default imageGenProcessor;
