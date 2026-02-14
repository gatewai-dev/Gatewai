import type {
	BackendNodeProcessorCtx,
	BackendNodeProcessorResult,
	NodeProcessor,
	NodeResult,
} from "@gatewai/core/types";
import { injectable } from "tsyringe";

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
