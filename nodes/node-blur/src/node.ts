import assert from "node:assert";
import { TOKENS } from "@gatewai/core/di";
import type {
    BlurResult,
    FileData,
    NodeResult,
} from "@gatewai/core/types";
import { DataType } from "@gatewai/db";
import {
    type BackendNodeProcessorCtx,
    type BackendNodeProcessorResult,
    defineNode,
    type GraphResolvers,
    type MediaService,
    type NodeProcessor,
    type StorageService,
} from "@gatewai/node-sdk";
import { inject, injectable } from "tsyringe";
import { metadata } from "./metadata.js";

@injectable()
class BlurProcessor implements NodeProcessor {
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
            const blurSize = (node.config as any).size ?? 0;

            const { dataUrl, ...dimensions } = await this.media.backendPixiService.processBlur(
                imageUrl,
                { blurSize },
                undefined,
                data.apiKey,
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

            const key = `${(data.task ?? node).id}/${Date.now()}.png`;
            const { signedUrl, key: tempKey } = await this.storage.uploadToTemporaryFolder(
                uploadBuffer,
                mimeType,
                key,
            );

            const newGeneration: BlurResult["outputs"][number] = {
                items: [
                    {
                        type: DataType.Image,
                        data: {
                            processData: {
                                dataUrl: signedUrl,
                                tempKey,
                                mimeType: mimeType,
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
                error: err instanceof Error ? err.message : "Blur processing failed",
            };
        }
    }
}

export default defineNode(metadata, {
    backendProcessor: BlurProcessor,
});
