import type { EnvConfig } from "@gatewai/core";
import { generateId, logger } from "@gatewai/core";
import { TOKENS } from "@gatewai/core/di";
import type { FileData, ImageGenResult } from "@gatewai/core/types";
import type { PrismaClient } from "@gatewai/db";
import { DataType } from "@gatewai/db";
import type {
    AIProvider,
    BackendNodeProcessorCtx,
    BackendNodeProcessorResult,
    GraphResolvers,
    MediaService,
    NodeProcessor,
    StorageService,
} from "@gatewai/node-sdk/server";
import type { GoogleGenAI, Part } from "@google/genai";
import { inject, injectable } from "tsyringe";
import metadata, { ImageGenNodeConfigSchema } from "../metadata.js";

@injectable()
export class ImageGenProcessor implements NodeProcessor {
    constructor(
        @inject(TOKENS.PRISMA) private prisma: PrismaClient,
        @inject(TOKENS.ENV) private env: EnvConfig,
        @inject(TOKENS.GRAPH_RESOLVERS) private graph: GraphResolvers,
        @inject(TOKENS.STORAGE) private storage: StorageService,
        @inject(TOKENS.MEDIA) private media: MediaService,
        @inject(TOKENS.AI_PROVIDER) private aiProvider: AIProvider,
    ) { }

    async process({
        node,
        data,
    }: BackendNodeProcessorCtx): Promise<BackendNodeProcessorResult> {
        try {
            const genAI = this.aiProvider.getGemini<GoogleGenAI>();

            const userPrompt = this.graph.getInputValue(data, node.id, true, {
                dataType: DataType.Text,
                label: "Prompt",
            })?.data as string;

            const imageFileData = this.graph.getInputValuesByType(data, node.id, {
                dataType: DataType.Image,
            }).map((m) => m?.data) as FileData[] | null;

            const nodeConfig = ImageGenNodeConfigSchema.parse(node.config);

            // 1. Prepare Parts for the Model
            const parts: Part[] = [];

            logger.debug(`User prompt: ${userPrompt}`);
            if (userPrompt) {
                parts.push({ text: userPrompt });
            }

            logger.info(`Number of reference images: ${imageFileData?.length ?? 0}`);

            // Convert reference images to inlineData for Google SDK
            for (const imgData of imageFileData || []) {
                if (!imgData) continue;

                const arrayBuffer = await this.graph.loadMediaBuffer(imgData);
                const buffer = Buffer.from(arrayBuffer);
                const base64Data = buffer.toString("base64");
                const mimeType = (await this.graph.getFileDataMimeType(imgData)) ?? "image/png";

                parts.push({
                    inlineData: { mimeType, data: base64Data },
                });
            }

            if (parts.length === 0) {
                return { success: false, error: "No user prompt or image provided" };
            }

            // 2. Execute Image Generation using generateContent
            const response = await genAI.models.generateContent({
                model: nodeConfig.model,
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
                        nodeConfig.model === "gemini-3-pro-image-preview"
                            ? {
                                aspectRatio: nodeConfig.aspectRatio,
                                imageSize: nodeConfig.imageSize,
                            }
                            : undefined,
                },
            });

            // 3. Process the Result
            const candidate = response.candidates?.[0];
            const contentParts = candidate?.content?.parts;
            const imagePart = contentParts?.find((part: any) => part.inlineData);

            if (!imagePart || !imagePart.inlineData || !imagePart.inlineData.data) {
                const textPart = contentParts?.find((part: any) => part.text)?.text;
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

            const dimensions = await this.media.getImageDimensions(buffer);
            const randId = generateId();
            const fileName = `${node.name}_${randId}.${extension}`;
            const key = `assets/${fileName}`;
            const bucket = this.env.GCS_ASSETS_BUCKET;

            await this.storage.uploadToStorage(buffer, key, contentType, bucket);
            const size = buffer.length;

            const asset = await this.prisma.fileAsset.create({
                data: {
                    name: fileName,
                    userId: data.canvas.userId,
                    bucket,
                    key,
                    size,
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