import { defineNode, type NodeProcessor } from "@gatewai/node-sdk";
import { injectable } from "tsyringe";
import { manifest } from "../metadata.js";

@injectable()
export class ImageCompositorProcessor implements NodeProcessor {
	async process() {
		return { success: true };
	}
}

export default defineNode(manifest, {
	backendProcessor: ImageCompositorProcessor,
});
