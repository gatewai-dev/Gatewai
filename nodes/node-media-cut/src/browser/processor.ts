import type {
	NodeProcessorParams,
	VirtualMediaData,
} from "@gatewai/core/types";
import type { IBrowserProcessor } from "@gatewai/node-sdk/browser";
import {
	appendOperation,
	getActiveVideoMetadata,
} from "@gatewai/remotion-compositions";
import { MediaCutConfigSchema } from "../shared/config.js";
import type { MediaCutResult } from "../shared/index.js";

export class MediaCutBrowserProcessor implements IBrowserProcessor {
	async process({
		node,
		inputs,
		context,
	}: NodeProcessorParams): Promise<MediaCutResult | null> {
		const videoInputs = Object.values(inputs).filter(
			({ connectionValid, outputItem }) =>
				connectionValid && outputItem?.type === "Video",
		);
		const audioInputs = Object.values(inputs).filter(
			({ connectionValid, outputItem }) =>
				connectionValid && outputItem?.type === "Audio",
		);

		if (
			videoInputs.length > 1 ||
			(videoInputs.length > 0 && audioInputs.length > 0)
		) {
			throw new Error(
				"Cannot connect both Video and Audio inputs. Please connect only one.",
			);
		}

		const connectedInput = videoInputs[0] ?? audioInputs[0];

		if (!connectedInput?.outputItem) {
			throw new Error("Missing Video or Audio input");
		}

		const inputMedia = connectedInput.outputItem.data as VirtualMediaData;
		console.log({ inputMedia });
		const { startSec, endSec } = MediaCutConfigSchema.parse(node.config);

		const currentMeta = getActiveVideoMetadata(inputMedia);
		if (!currentMeta) {
			throw new Error("Unable to read media metadata");
		}

		const durationMs = currentMeta.durationMs ?? 0;
		if (durationMs <= 0) {
			throw new Error("Media duration is unknown or zero");
		}

		let startMs = startSec * 1000;
		let endMs = endSec ? endSec * 1000 : durationMs;

		if (startMs < 0 || endMs > durationMs || endMs <= startMs) {
			startMs = 0;
			endMs = durationMs;
		}

		const output = appendOperation(inputMedia, {
			op: "cut",
			startSec: startMs / 1000,
			endSec: endMs / 1000,
			metadata: {
				...currentMeta,
				durationMs: endMs - startMs,
			},
		});

		const outputHandle = context.getFirstOutputHandle(node.id);
		if (!outputHandle) throw new Error("Missing output handle");

		const inputType = connectedInput.outputItem.type as "Video" | "Audio";

		return {
			selectedOutputIndex: 0,
			outputs: [
				{
					items: [
						{
							type: inputType,
							data: output,
							outputHandleId: outputHandle,
						},
					],
				},
			],
		};
	}
}
