import type { NodeResult } from "@gatewai/core/types";
import type {
	BackendNodeProcessorCtx,
	BackendNodeProcessorResult,
	defineNode,
	NodeProcessor,
} from "@gatewai/node-sdk/server";
import { manifest } from "../metadata.js";

@injectable()
export class VideoCompositorProcessor implements NodeProcessor {
	async process(ctx: BackendNodeProcessorCtx) {
		const result: BackendNodeProcessorResult = {
			success: true,
			newResult: ctx.node.result as NodeResult,
		};
		// Implementation placeholder
		return result;
	}
}

export const videoCompositorNode = defineNode(manifest, {
	backendProcessor: VideoCompositorProcessor,
});

export default videoCompositorNode;
