import type { ImportResult } from "../shared/index.js";

import type { IBrowserProcessor } from "@gatewai/node-sdk/browser";
import type { NodeProcessorParams } from "@gatewai/react-canvas";
import { ImportNodeConfigSchema } from "../shared/config.js";

export class ImportBrowserProcessor implements IBrowserProcessor {
	async process({
		node,
		context,
	}: NodeProcessorParams): Promise<ImportResult | null> {
		const outputHandle = context.getFirstOutputHandle(node.id);
		const config = ImportNodeConfigSchema.parse(node.config);
		const asset = config.asset;

		if (!outputHandle) throw new Error("No output handle");
		if (!asset) throw new Error("No asset");

		let dataType: "Image" | "Video" | "Audio" = "Image";
		if (asset.mimeType.startsWith("image/")) {
			dataType = "Image";
		} else if (asset.mimeType.startsWith("video/")) {
			dataType = "Video";
		} else if (asset.mimeType.startsWith("audio/")) {
			dataType = "Audio";
		}

		return {
			selectedOutputIndex: 0 as const,
			outputs: [
				{
					items: [
						{
							type: dataType,
							data: {
								entity: asset,
							},
							outputHandleId: outputHandle,
						},
					],
				},
			],
		} as any as ImportResult;
	}
}
