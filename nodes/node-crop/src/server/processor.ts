
import assert from "node:assert";
import { TOKENS } from "@gatewai/core/di";
import type { CropResult, FileData } from "@gatewai/core/types";
import { DataType } from "@gatewai/db";
import type {
    BackendNodeProcessorCtx,
    BackendNodeProcessorResult,
    GraphResolvers,
    MediaService,
    NodeProcessor,
    StorageService,
} from "@gatewai/node-sdk/server";
import { inject, injectable } from "tsyringe";
import { applyCrop } from "@/shared/pixi-crop-run.js";
import { CropNodeConfigSchema } from "../shared/config.js";

@injectable()
export class CropProcessor implements NodeProcessor {
    constructor(
        @inject(TOKENS.STORAGE) private storage: StorageService,
        @inject(TOKENS.MEDIA) private media: MediaService,
        @inject(TOKENS.GRAPH_RESOLVERS) private graph: GraphResolvers,
    ) { }

    async process({
        node,
        data,
    }: BackendNodeProcessorCtx): Promise<BackendNodeProcessorResult> {
        try {
            const imageInput = this.graph.getInputValue(data, node.id, true, {
                dataType: DataType.Image,
                label: "Image",
            })?.data as FileData | null;

            assert(imageInput);
            const imageUrl = await this.media.resolveFileDataUrl(imageInput);
            assert(imageUrl);

            const validatedConfig = CropNodeConfigSchema.parse(node.config);

            const { dataUrl, ...dimensions } = await this.media.backendPixiService.execute(
                node.id,
                {
                    imageUrl,
                    options: validatedConfig,
                    apiKey: data.apiKey,
                },
                applyCrop,
            );

            const uploadBuffer = Buffer.from(await dataUrl.arrayBuffer());
            const mimeType = dataUrl.type;

            const outputHandle = data.handles.find(
                (h) => h.nodeId === node.id && h.type === "Output",
            );
            if (!outputHandle)
                return { success: false, error: "Output handle is missing." };

            const newResult: CropResult = structuredClone(
                node.result as unknown as CropResult,
            ) ?? {
                outputs: [],
                selectedOutputIndex: 0,
            };

            const key = `${(data.task ?? node).id}/${Date.now()}.png`;
            const { signedUrl, key: tempKey } =
                await this.storage.uploadToTemporaryStorageFolder(
                    uploadBuffer,
                    mimeType,
                    key,
                );

            const newGeneration: CropResult["outputs"][number] = {
                items: [
                    {
                        type: DataType.Image,
                        data: {
                            processData: {
                                dataUrl: signedUrl,
                                tempKey,
                                mimeType,
                                ...dimensions,
                            },
                        },
                        outputHandleId: outputHandle.id,
                    },
                ],
            };

            newResult.outputs = [newGeneration];
            newResult.selectedOutputIndex = 0;

            return { success: true, newResult };
        } catch (err: unknown) {
            return {
                success: false,
                error: err instanceof Error ? err.message : "Crop processing failed",
            };
        }
    }
}