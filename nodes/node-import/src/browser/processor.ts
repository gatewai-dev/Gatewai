import type { IBrowserProcessor } from "@gatewai/node-sdk/browser";
import type { NodeProcessorParams } from "@gatewai/react-canvas";
import { createVirtualVideo } from "@gatewai/remotion-compositions";
import type { ImportResult } from "../shared/index.js";

export class ImportBrowserProcessor implements IBrowserProcessor {
	async process({
		node,
		context,
	}: NodeProcessorParams): Promise<ImportResult | null> {
		const outputHandle = context.getFirstOutputHandle(node.id);
		const result = node.result as ImportResult;

		if (!outputHandle) throw new Error("No output handle");

		return {
			...result,
			outputs: result.outputs?.map((output) => ({
				items: output.items.map((m) => ({
					type: m.type,
					outputHandleId: outputHandle,
					data:
						m.type === "Video" || m.type === "Audio"
							? createVirtualVideo(m.data, m.type as "Video" | "Audio")
							: m.data,
				})),
			})),
		} as any;
	}
}
