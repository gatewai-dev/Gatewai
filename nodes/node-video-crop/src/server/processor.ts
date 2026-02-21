import { TOKENS } from "@gatewai/core/di";
import type { VirtualVideoData } from "@gatewai/core/types";
import { DataType } from "@gatewai/db";
import type {
    BackendNodeProcessorCtx,
    BackendNodeProcessorResult,
    GraphResolvers,
    NodeProcessor,
} from "@gatewai/node-sdk/server";
import { appendOperation } from "@gatewai/remotion-compositions";
import { inject, injectable } from "inversify";
import { VideoCropConfigSchema } from "../shared/config.js";
import type { VideoCropResult } from "../shared/index.js";

@injectable()
export class VideoCropProcessor implements NodeProcessor {
    constructor(
        @inject(TOKENS.GRAPH_RESOLVERS) private graph: GraphResolvers,
    ) { }

    async process({
        node,
        data,
    }: BackendNodeProcessorCtx): Promise<BackendNodeProcessorResult<VideoCropResult>> {
        try {
            const videoInputs = this.graph.getInputValuesByType(data, node.id, {
                dataType: DataType.Video,
            });

            const inputVideo = videoInputs[0]?.data as VirtualVideoData | undefined;

            if (!inputVideo) {
                return { success: false, error: "Missing Video input" };
            }

            const config = VideoCropConfigSchema.parse(node.config);

            const width = config.width ?? inputVideo.sourceMeta.width ?? 1920;
            const height = config.height ?? inputVideo.sourceMeta.height ?? 1080;

            const output = appendOperation(inputVideo, {
                op: "crop",
                x: config.x,
                y: config.y,
                width,
                height,
            });

            const outputHandle = data.handles.find(
                (h) => h.nodeId === node.id && h.type === "Output",
            );
            if (!outputHandle) return { success: false, error: "Output handle is missing" };

            const newResult: VideoCropResult = {
                selectedOutputIndex: 0,
                outputs: [
                    {
                        items: [
                            {
                                type: DataType.Video,
                                data: output,
                                outputHandleId: outputHandle.id,
                            },
                        ],
                    },
                ],
            };

            return { success: true, newResult };
        } catch (err: unknown) {
            return {
                success: false,
                error: err instanceof Error ? err.message : "VideoCrop processing failed",
            };
        }
    }
}
