import assert from "node:assert";
import { readFile, rm } from "node:fs/promises";
import { type EnvConfig, type IMediaRendererService, logger } from "@gatewai/core";
import { container, TOKENS } from "@gatewai/core/di";
import type { VirtualMediaData } from "@gatewai/core/types";
import type { PrismaClient } from "@gatewai/db";
import type {
    BackendNodeProcessorCtx,
    BackendNodeProcessorResult,
    GraphResolvers,
    NodeProcessor, StorageService
} from "@gatewai/node-sdk/server";
import { inject, injectable } from "inversify";
import type { ExportResult } from "../shared/index.js";

@injectable()
export class ExportServerProcessor implements NodeProcessor {
    constructor(
        @inject(TOKENS.GRAPH_RESOLVERS) private graph: GraphResolvers,
        @inject(TOKENS.PRISMA) private prisma: PrismaClient,
        @inject(TOKENS.ENV) private env: EnvConfig,
        @inject(TOKENS.STORAGE) private storage: StorageService,
    ) { }

    async process({
        node,
        data,
    }: BackendNodeProcessorCtx): Promise<BackendNodeProcessorResult<ExportResult>> {
        try {
            const inputValue = this.graph.getInputValue(data, node.id, false, {});
            assert(inputValue);
            const newResult = structuredClone(
                node.result as unknown as ExportResult,
            ) ?? {
                outputs: [],
                selectedOutputIndex: 0,
            };

            let dataToPass = inputValue.data;
            const rendererSerice = container.get<IMediaRendererService>(TOKENS.MEDIA_RENDERER);
            // If the input value is VirtualMediaData, render it
            if (inputValue.type === "Video") {
                const virtualMedia = inputValue.data as VirtualMediaData;
                if (!virtualMedia.metadata.width || !virtualMedia.metadata.height || !virtualMedia.metadata.fps || !virtualMedia.metadata.durationMs) {
                    throw new Error("VirtualMediaData must have width, height, fps and durationInFrames");
                }

                let renderedVideo: { filePath: string } | undefined;
                try {
                    renderedVideo = await rendererSerice.renderComposition({
                        compositionId: "CompositionScene",
                        inputProps: {
                            virtualMedia,
                            viewportWidth: virtualMedia.metadata.width,
                            viewportHeight: virtualMedia.metadata.height,
                            type: "Video",
                        },
                        width: virtualMedia.metadata.width,
                        height: virtualMedia.metadata.height,
                        fps: virtualMedia.metadata.fps,
                        durationInFrames: virtualMedia.metadata.durationMs / 1000 * virtualMedia.metadata.fps,
                        envVariables: {
                            VITE_BASE_URL: this.env.BASE_URL,
                        },
                    });
                } catch (error) {
                    console.error({ errorW: error })
                    throw error;
                }
                if (!renderedVideo) throw new Error("Render produced no output");
                logger.info(`Rendered video: ${renderedVideo.filePath}`);
                const contentType = "video/mp4";
                const fileBuffer = await readFile(renderedVideo.filePath);

                const fileName = `render-export-${data.task?.id ?? node.id}-${new Date().getDate()}.mp4`;
                const key = `assets/exports/${fileName}`;

                // Upload to storage
                await this.storage.uploadToStorage(
                    fileBuffer,
                    key,
                    contentType,
                    this.env.GCS_ASSETS_BUCKET
                );

                // Clean up temp file
                try {
                    await rm(renderedVideo.filePath, { force: true });
                } catch (cleanupErr) {
                    logger.warn(`Failed to cleanup temp file: ${renderedVideo.filePath}`);
                }

                // Calculate duration properly
                const fps = virtualMedia.metadata.fps ?? 30;
                const durationMs = virtualMedia.metadata.durationMs ?? 1000;

                const asset = await this.prisma.fileAsset.create({
                    data: {
                        name: fileName,
                        userId: data.canvas.userId,
                        bucket: this.env.GCS_ASSETS_BUCKET,
                        key,
                        size: fileBuffer.length,
                        width: virtualMedia.metadata.width ?? 1920,
                        height: virtualMedia.metadata.height ?? 1080,
                        fps,
                        duration: durationMs,
                        mimeType: contentType,
                    },
                });

                // Set the asset into the input value's data so it passes down correctly to the output
                dataToPass = { entity: asset };
            }

            const newGeneration: ExportResult["outputs"][number] = {
                items: [
                    {
                        type: inputValue.type,
                        data: dataToPass,
                        outputHandleId: undefined,
                    } as unknown as ExportResult["outputs"][number]["items"][number],
                ],
            };

            newResult.outputs.push(newGeneration);
            newResult.selectedOutputIndex = 0;

            return { success: true, newResult };
        } catch (err: unknown) {
            if (err instanceof Error) {
                return { success: false, error: err.message };
            }
            return { success: false, error: "Export processing failed" };
        }
    }
}
