import type {
	BackendNodeProcessorResult,
	NodeProcessor,
} from "@gatewai/node-sdk";
import { defineNode } from "@gatewai/node-sdk";
import { injectable } from "tsyringe";
import metadata from "../metadata.js";

@injectable()
class PreviewProcessor implements NodeProcessor {
	async process(): Promise<BackendNodeProcessorResult> {
		return { success: true };
	}
}

export const previewNode = defineNode(metadata, {
	backendProcessor: PreviewProcessor,
});

export default previewNode;
