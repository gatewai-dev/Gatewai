import type { FileResult } from "@gatewai/core/types";
import type {
	BackendNodeProcessorCtx,
	BackendNodeProcessorResult,
	defineNode,
	NodeProcessor,
} from "@gatewai/node-sdk/server";
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

export const fileNode = defineNode(metadata, {
	backendProcessor: FileProcessor,
});

export default fileNode;
