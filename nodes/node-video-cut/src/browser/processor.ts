import type {
	NodeProcessorParams,
	VirtualVideoData,
} from "@gatewai/core/types";
import type { IBrowserProcessor } from "@gatewai/node-sdk/browser";
import {
	appendOperation,
	getActiveVideoMetadata,
} from "@gatewai/remotion-compositions";
import { VideoCutConfigSchema } from "../shared/config.js";
import type { VideoCutResult } from "../shared/index.js";

export class VideoCutBrowserProcessor implements IBrowserProcessor {
	async process({
		node,
		inputs,
		context,
	}: NodeProcessorParams): Promise<VideoCutResult | null> {
		// Get VirtualVideoData from the first connected Video input
		const videoInput = Object.values(inputs).find(
			({ connectionValid, outputItem }) =>
				connectionValid && outputItem?.type === "Video",
		);

		if (!videoInput?.outputItem) {
			throw new Error("Missing Video input");
		}

		const inputVideo = videoInput.outputItem.data as VirtualVideoData;
		const { startSec, endSec } = VideoCutConfigSchema.parse(node.config);

		const currentMeta = getActiveVideoMetadata(inputVideo);
		if (!currentMeta?.durationMs) throw new Error("The duration of input video is unknown");

		const startMs = startSec * 1000;
		const endMs = endSec ? (endSec * 1000) : currentMeta.durationMs;

		if (endMs <= startMs) {
			throw new Error("End timestamp must be bigger than start");
		}

		const output = appendOperation(inputVideo, {
			op: "cut",
			startSec,
			endSec,
			metadata: {
				...currentMeta,
				durationMs: (endMs - startMs),
			},
		});

		const outputHandle = context.getFirstOutputHandle(node.id);
		if (!outputHandle) throw new Error("Missing output handle");

		return {
			selectedOutputIndex: 0,
			outputs: [
				{
					items: [
						{
							type: "Video",
							data: output,
							outputHandleId: outputHandle,
						},
					],
				},
			],
		};
	}
}
