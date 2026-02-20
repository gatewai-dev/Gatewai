import { TOKENS } from "@gatewai/core/di";
import type { FileData, ModulateResult, NodeResult } from "@gatewai/core/types";
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
import { ModulateNodeConfigSchema } from "../metadata.js";
import { applyModulate } from "../shared/pixi-modulate-run.js";

@injectable()
export class ModulateProcessor implements NodeProcessor {
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
            const modulateConfig = ModulateNodeConfigSchema.parse(node.config);

            if (!imageInput) {
                return { success: false, error: "No image input provided" };
            }

            const arrayBuffer = await this.graph.loadMediaBuffer(imageInput);
            const buffer = Buffer.from(arrayBuffer);
            const base64Data = this.media.bufferToDataUrl(buffer, "image/png");

            const { dataUrl, ...dimensions } =
                await this.media.backendPixiService.execute(
                    node.id,
                    {
                        imageUrl: base64Data,
                        config: modulateConfig,
                        apiKey: data.apiKey,
                    },
                    applyModulate
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

            const newGeneration: ModulateResult["outputs"][number] = {
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
            newResult.selectedOutputIndex = newResult.outputs.length - 1;

            return { success: true, newResult };
        } catch (err: unknown) {
            return {
                success: false,
                error:
                    err instanceof Error ? err.message : "Modulate processing failed",
            };
        }
    }
}
