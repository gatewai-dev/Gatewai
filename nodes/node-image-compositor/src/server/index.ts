import type {
	BackendNodeProcessorCtx,
	BackendNodeProcessorResult,
	NodeProcessor,
	NodeResult,
} from "@gatewai/core/types";
import { defineNode } from "@gatewai/node-sdk/server";
import { injectable } from "tsyringe";
import { manifest } from "../metadata.js";

@injectable()
export class ImageCompositorProcessor implements NodeProcessor {
	async process(ctx: BackendNodeProcessorCtx) {
		const result: BackendNodeProcessorResult = {
			success: true,
			newResult: ctx.node.result as NodeResult,
		};
		// Implementation placeholder
		return result;
	}
}

export const compositorNode = defineNode(manifest, {
	backendProcessor: ImageCompositorProcessor,
});

export default compositorNode;
