import type { FileResult } from "@gatewai/core/types";
import type {
	BackendNodeProcessorCtx,
	BackendNodeProcessorResult,
	NodeProcessor,
} from "@gatewai/node-sdk";
import { defineNode } from "@gatewai/node-sdk";
import { injectable } from "tsyringe";
import metadata from "../metadata.js";

@injectable()
class FileProcessor implements NodeProcessor {
	async process({
		node,
	}: BackendNodeProcessorCtx): Promise<BackendNodeProcessorResult> {
		return {
			success: true,
			newResult: node.result as unknown as FileResult,
		};
	}
}

export default defineNode(metadata, { backendProcessor: FileProcessor });
