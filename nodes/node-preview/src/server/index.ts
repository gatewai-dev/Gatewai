import type {
	BackendNodeProcessorResult,
	defineNode,
	NodeProcessor,
} from "@gatewai/node-sdk/server";
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
