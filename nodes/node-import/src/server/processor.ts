import type {
	BackendNodeProcessorCtx,
	BackendNodeProcessorResult,
	NodeProcessor,
} from "@gatewai/node-sdk/server";
import { createVirtualVideo } from "@gatewai/remotion-compositions";
import { injectable } from "inversify";
import type { ImportResult } from "../shared/index.js";

@injectable()
export class ImportProcessor implements NodeProcessor {
	async process({
		node,
		data,
	}: BackendNodeProcessorCtx): Promise<
		BackendNodeProcessorResult<ImportResult>
	> {
		const outputHandle = data.handles.find(
			(h) => h.nodeId === node.id && h.type === "Output",
		);

		if (!outputHandle) {
			return {
				success: false,
				error: "No output handle found",
			};
		}

		const result = node.result as ImportResult;

		if (!result || !result.outputs) {
			return {
				success: true,
				newResult: {
					outputs: [],
					selectedOutputIndex: 0,
				} as unknown as ImportResult,
			};
		}

		return {
			success: true,
			newResult: {
				...result,
				outputs: result.outputs?.map((output) => ({
					items: output.items.map((m) => ({
						type: m.type,
						outputHandleId: outputHandle.id,
						data:
							m.type === "Video" || m.type === "Audio"
								? createVirtualVideo(m.data, m.type as "Video" | "Audio")
								: m.data,
					})),
				})),
			} as ImportResult,
		};
	}
}
