import type { EnvConfig } from "@gatewai/core";
import { logger } from "@gatewai/core";
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
} from "@gatewai/node-sdk";
import { defineNode } from "@gatewai/node-sdk";
import { inject, injectable } from "tsyringe";
import metadata, { ImageGenNodeConfigSchema } from "../metadata.js";

@injectable()
class ImageGenProcessor implements NodeProcessor {
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
            const genAI = this.aiProvider.getClient(this.env.GEMINI_API_KEY);

            const userPrompt = this.graph.getInputValue(data, node.id, true, {
                dataType: DataType.Text,
                label: "Prompt",
            })?.data as string;

            const imageInput = this.graph.getInputValue(data, node.id, false, {
                dataType: DataType.Image,
                label: "Image",
            })?.data as FileData | null;

            const nodeConfig = ImageGenNodeConfigSchema.parse(node.config);

            let inputImageBase64: string | undefined;
            let inputImageMimeType: string | undefined;

            if (imageInput) {
                const arrayBuffer = await this.graph.loadMediaBuffer(imageInput);
                const buffer = Buffer.from(arrayBuffer);
                inputImageBase64 = buffer.toString("base64");
                const mimeType = await this.graph.getFileDataMimeType(imageInput);
                if (mimeType) inputImageMimeType = mimeType;
            }

            const isGeminiModel = nodeConfig.model.includes("gemini");

            let generatedImageBase64: string | undefined;
            let generatedMimeType = "image/png";

            if (isGeminiModel) {
                const parts: any[] = [];
                if (inputImageBase64 && inputImageMimeType) {
                    parts.push({
                        inlineData: {
                            data: inputImageBase64,
                            mimeType: inputImageMimeType,
                        },
                    });
                }
                parts.push(userPrompt);

                const response = await genAI.models.generateContent({
                    model: nodeConfig.model,
                    contents: [{ role: "user", parts }],
                    config: {
                        responseModalities: ["IMAGE", "TEXT"],
                    },
                });

                const imagePart = response.candidates?.[0]?.content?.parts?.find(
                    (p: any) => p.inlineData?.mimeType?.startsWith("image/"),
                );

                if (!imagePart?.inlineData?.data) {
                    return { success: false, error: "No image generated" };
                }

                generatedImageBase64 = imagePart.inlineData.data;
                generatedMimeType = imagePart.inlineData.mimeType || "image/png";
            } else {
                const generateConfig: any = {
                    numberOfImages: nodeConfig.numberOfImages ?? 1,
                    aspectRatio: nodeConfig.aspectRatio,
                };

                if (inputImageBase64 && inputImageMimeType) {
                    generateConfig.referenceImages = [
                        {
                            referenceImage: {
                                imageBytes: inputImageBase64,
                                mimeType: inputImageMimeType,
                            },
                            referenceType: "STYLE",
                        },
                    ];
                }

                const response = await genAI.models.generateImages({
                    model: nodeConfig.model,
                    prompt: userPrompt,
                    config: generateConfig,
                });

                if (
                    !response.generatedImages ||
                    response.generatedImages.length === 0
                ) {
                    return { success: false, error: "No image generated" };
                }

                generatedImageBase64 =
                    response.generatedImages[0].image?.imageBytes;
                generatedMimeType =
                    response.generatedImages[0].image?.mimeType || "image/png";
            }

            if (!generatedImageBase64) {
                return { success: false, error: "Image generation produced no data" };
            }

            const imageBuffer = Buffer.from(generatedImageBase64, "base64");

            const extension =
                generatedMimeType === "image/jpeg"
                    ? ".jpg"
                    : generatedMimeType === "image/webp"
                        ? ".webp"
                        : ".png";
            const key = `${(data.task ?? node).id}/${Date.now()}${extension}`;

            const { signedUrl, key: tempKey } =
                await this.storage.uploadToTemporaryStorageFolder(
                    imageBuffer,
                    generatedMimeType,
                    key,
                );

            const dimensions = await this.media.getImageDimensions(imageBuffer);

            const outputHandle = data.handles.find(
                (h) => h.nodeId === node.id && h.type === "Output",
            );
            if (!outputHandle) {
                return { success: false, error: "Output handle is missing." };
            }

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
                        data: {
                            processData: {
                                dataUrl: signedUrl,
                                tempKey,
                                mimeType: generatedMimeType,
                                ...dimensions,
                            },
                        },
                        outputHandleId: outputHandle.id,
                    },
                ],
            };

            newResult.outputs.push(newGeneration);
            newResult.selectedOutputIndex = newResult.outputs.length - 1;

            return { success: true, newResult };
        } catch (err: unknown) {
            logger.error(
                err instanceof Error ? err.message : "ImageGen processing failed",
            );
            return {
                success: false,
                error:
                    err instanceof Error ? err.message : "ImageGen processing failed",
            };
        }
    }
}

export default defineNode(metadata, { backendProcessor: ImageGenProcessor });
