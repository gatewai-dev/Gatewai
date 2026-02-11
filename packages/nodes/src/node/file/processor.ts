import type {
    BackendNodeProcessorCtx,
    BackendNodeProcessorResult,
    NodeProcessor,
} from "@gatewai/node-sdk";
import type { FileResult } from "@gatewai/types";
import { injectable } from "tsyringe";

@injectable()
export class FileProcessor implements NodeProcessor {
    async process({
        node,
    }: BackendNodeProcessorCtx): Promise<BackendNodeProcessorResult> {
        return {
            success: true,
            newResult: node.result as unknown as FileResult,
        };
    }
}

export default FileProcessor;
