import type {
    BackendNodeProcessorCtx,
    BackendNodeProcessorResult,
    NodeProcessor,
} from "@gatewai/node-sdk";
import type { VideoCompositorResult } from "@gatewai/core/types";
import { injectable } from "tsyringe";

@injectable()
export class VideoCompositorProcessor implements NodeProcessor {
    async process({
        node,
    }: BackendNodeProcessorCtx): Promise<BackendNodeProcessorResult> {
        return {
            success: true,
            newResult: node.result as unknown as VideoCompositorResult,
        };
    }
}

export default VideoCompositorProcessor;
