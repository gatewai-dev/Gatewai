import type {
    BackendNodeProcessorCtx,
    BackendNodeProcessorResult,
    NodeProcessor,
} from "@gatewai/node-sdk";
import type { NodeResult } from "@gatewai/types";
import { injectable } from "tsyringe";

@injectable()
export class NoteProcessor implements NodeProcessor {
    async process({
        node,
    }: BackendNodeProcessorCtx): Promise<BackendNodeProcessorResult> {
        return {
            success: true,
            newResult: node.result as unknown as NodeResult,
        };
    }
}

export default NoteProcessor;
