import type { NodeResult } from "@gatewai/core/types";
import type {
	BackendNodeProcessorCtx,
	BackendNodeProcessorResult,
	NodeProcessor,
} from "./types.js";

export class ServerPassthroughProcessor implements NodeProcessor {
	process(ctx: BackendNodeProcessorCtx): Promise<BackendNodeProcessorResult> {
		return Promise.resolve({
			newResult: ctx.node.result as NodeResult,
			success: true,
		});
	}
}
