import { DataType } from "@gatewai/db";
import type {
	BackendNodeProcessorCtx,
	BackendNodeProcessorResult,
	NodeProcessor,
} from "@gatewai/node-sdk/server";
import { createVirtualVideo } from "@gatewai/remotion-compositions";
import { injectable } from "inversify";
import { ImportNodeConfigSchema } from "../metadata.js";
import type { ImportResult } from "../shared/index.js";

@injectable()
export class ImportProcessor implements NodeProcessor {
	async process({
		node,
		data,
	}: BackendNodeProcessorCtx): Promise<
		BackendNodeProcessorResult<ImportResult>
	> {
		const config = ImportNodeConfigSchema.parse(node.config);
		const asset = config.asset;

		if (!asset) {
			// No asset loaded, return empty result or maybe just success without outputs?
			// Text node returns empty string.
			return {
				success: true,
				newResult: {
					outputs: [],
					selectedOutputIndex: 0,
				} as unknown as ImportResult,
			};
		}

		let dataType: DataType;
		if (asset.mimeType.startsWith("image/")) {
			dataType = DataType.Image;
		} else if (asset.mimeType.startsWith("video/")) {
			dataType = DataType.Video;
		} else if (asset.mimeType.startsWith("audio/")) {
			dataType = DataType.Audio;
		} else {
			// Fallback or error?
			console.warn(`Unknown asset mimeType: ${asset.mimeType}`);
			dataType = DataType.Image; // Default? Or maybe throw error?
		}

		const outputHandle = data.handles.find(
			(h) => h.nodeId === node.id && h.type === "Output",
		);

		if (!outputHandle) {
			return {
				success: false,
				error: "No output handle found",
			};
		}

		return {
			success: true,
			newResult: {
				outputs: [
					{
						items: [
							{
								type: dataType,
								data:
									dataType === DataType.Video
										? createVirtualVideo({ entity: asset })
										: {
												entity: asset,
											},
								outputHandleId: outputHandle.id,
							},
						],
					},
				],
				selectedOutputIndex: 0,
			} as unknown as ImportResult,
		};
	}
}
