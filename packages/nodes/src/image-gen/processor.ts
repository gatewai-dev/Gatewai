import assert from "node:assert";
import { generateId, logger, type EnvConfig } from "@gatewai/core";
import { DataType } from "@gatewai/db";
import {
	type BackendNodeProcessorCtx,
	type BackendNodeProcessorResult,
	type GraphResolvers,
	type MediaService,
	type NodeProcessor,
	type StorageService,
	TOKENS,
} from "@gatewai/node-sdk";
import {
	type FileData,
	ImageGenNodeConfigSchema,
	type ImageGenResult,
} from "@gatewai/types";
import { inject, injectable } from "tsyringe";
import { getGenAIClient } from "../genai.js";

@injectable()
export class ImageGenProcessor implements NodeProcessor {
	constructor(
		@inject(TOKENS.ENV) private env: EnvConfig,
		@inject(TOKENS.GRAPH_RESOLVERS) private graph: GraphResolvers,
		@inject(TOKENS.STORAGE) private storage: StorageService,
		@inject(TOKENS.MEDIA) private media: MediaService,
	) { }

	async process(ctx: BackendNodeProcessorCtx): Promise<BackendNodeProcessorResult> {
		const { node, data, prisma } = ctx;
		const genAI = getGenAIClient(this.env.GEMINI_API_KEY);

		try {
			const userPrompt = this.graph.getInputValue(data, node.id, true, {
				dataType: DataType.Text,
				label: "Prompt",
			})?.data as string;

			const imageFileData = this.graph
				.getInputValuesByType(data, node.id, {
					dataType: DataType.Image,
				})
				.map((m) => m?.data) as FileData[] | null;

			const parts: Array<Record<string, unknown>> = [];

			logger.debug(`User prompt: ${userPrompt}`);
			if (userPrompt) {
				parts.push({ text: userPrompt });
			}

			logger.info(`Number of reference images: ${imageFileData?.length ?? 0}`);

			for (const imgData of imageFileData || []) {
				if (!imgData) continue;

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

				const arrayBuffer = await this.storage.getFromGCS(key, bucket);
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

			const response = (await genAI.models.generateContent({
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
			})) as {
				candidates?: Array<{
					content?: {
						parts?: Array<{
							inlineData?: { mimeType?: string; data?: string };
							text?: string;
						}>;
					};
				}>;
			};

			const candidate = response.candidates?.[0];
			const contentParts = candidate?.content?.parts;
			const imagePart = contentParts?.find((part) => part.inlineData);

			if (!imagePart || !imagePart.inlineData || !imagePart.inlineData.data) {
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

			let extension = "png";
			if (mimeType.includes("jpeg") || mimeType.includes("jpg"))
				extension = "jpg";
			else if (mimeType.includes("webp")) extension = "webp";

			const contentType = mimeType;

			const dimensions = await this.media.getImageDimensions(buffer);
			const randId = generateId();
			const fileName = `${node.name}_${randId}.${extension}`;
			const key = `assets/${fileName}`;
			const bucket = this.env.GCS_ASSETS_BUCKET;

			await this.storage.uploadToGCS(buffer, key, contentType, bucket);
			const size = buffer.length;

			const expiresIn = 3600 * 24 * 6.9;
			const signedUrl = await this.storage.generateSignedUrl(key, bucket, expiresIn);
			const signedUrlExp = new Date(Date.now() + expiresIn * 1000);

			const asset = await prisma.fileAsset.create({
				data: {
					name: fileName,
					userId: (data.canvas as unknown as { userId: string }).userId,
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
	}
}

export default ImageGenProcessor;
