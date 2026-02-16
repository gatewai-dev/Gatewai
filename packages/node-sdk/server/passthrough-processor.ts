import type { NodeProcessor, NodeProcessorParams, NodeProcessorResult } from "@gatewai/core/types";

export class ServerPassthroughProcessor implements NodeProcessor {
    process(params: NodeProcessorParams): Promise<NodeProcessorResult> {
        return Promise.resolve({
            result: params.node.result,
            success: true,
        });
    }
}