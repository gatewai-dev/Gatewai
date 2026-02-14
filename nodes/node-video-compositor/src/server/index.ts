import type { NodeResult } from "@gatewai/core/types";
import type {
	BackendNodeProcessorCtx,
	BackendNodeProcessorResult,
	NodeProcessor,
} from "@gatewai/node-sdk";
import { injectable } from "tsyringe";
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
