import { TOKENS } from "@gatewai/core/di";
import type { FileData, NodeResult } from "@gatewai/core/types";
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
import { ResizeNodeConfigSchema } from "../metadata.js";
import { applyResize } from "../shared/pixi-resize-run.js";

@injectable()
export class ResizeProcessor implements NodeProcessor {
    constructor(
        @inject(TOKENS.STORAGE) private storage: StorageService,
        @inject(TOKENS.MEDIA) private media: MediaService,
        @inject(TOKENS.GRAPH_RESOLVERS) private graph: GraphResolvers,
    ) { }

    async process({
        node,
        data,
    }: BackendNodeProcessorCtx): Promise<BackendNodeProcessorResult<NodeResult>> {
        try {
            const imageInput = this.graph.getInputValue(data, node.id, true, {
                dataType: DataType.Image,
                label: "Image",
            })?.data as FileData | null;

            if (!imageInput) {
                return { success: false, error: "No image input provided" };
            }

            const resizeConfig = ResizeNodeConfigSchema.parse(node.config);
            const imageUrl = await this.media.resolveFileDataUrl(imageInput);
            if (!imageUrl) {
                return { success: false, error: "Failed to resolve image URL" };
            }

            const { dataUrl, ...dimensions } =
                await this.media.backendPixiService.execute(
                    node.id,
                    {
                        imageUrl,
                        options: resizeConfig,
                        apiKey: data.apiKey,
                    },
                    applyResize
                );

            const uploadBuffer = Buffer.from(await dataUrl.arrayBuffer());
            const mimeType = dataUrl.type;

            const outputHandle = data.handles.find(
                (h) => h.nodeId === node.id && h.type === "Output",
            );
            if (!outputHandle)
                return { success: false, error: "Output handle is missing." };

            const newResult: NodeResult = structuredClone(
                node.result as NodeResult,
            ) ?? {
                outputs: [],
                selectedOutputIndex: 0,
            };

            const key = `${node.id}/${Date.now()}.png`;
            const { signedUrl, key: tempKey } =
                await this.storage.uploadToTemporaryStorageFolder(
                    uploadBuffer,
                    mimeType,
                    key,
                );

            const newGeneration: NodeResult["outputs"][number] = {
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
                error:
                    err instanceof Error ? err.message : "Resize processing failed",
            };
        }
    }
}
