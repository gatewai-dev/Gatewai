import type { NodeResult } from "@gatewai/core/types";
import type {
	BackendNodeProcessorCtx,
	BackendNodeProcessorResult,
	defineNode,
	NodeProcessor,
} from "@gatewai/node-sdk/server";
import { injectable } from "tsyringe";
import metadata from "../metadata.js";

@injectable()
class NoteProcessor implements NodeProcessor {
	async process({
		node,
	}: BackendNodeProcessorCtx): Promise<BackendNodeProcessorResult> {
		return {
			success: true,
			newResult: node.result as unknown as NodeResult,
		};
	}
}

export const noteNode = defineNode(metadata, {
	backendProcessor: NoteProcessor,
});

export default noteNode;
