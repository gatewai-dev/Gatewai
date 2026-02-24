import { TOKENS } from "@gatewai/core/di";
import type { VirtualVideoData } from "@gatewai/core/types";
import { DataType } from "@gatewai/db";
import type {
	BackendNodeProcessorCtx,
	BackendNodeProcessorResult,
	GraphResolvers,
	NodeProcessor,
} from "@gatewai/node-sdk/server";
import {
	appendOperation,
	getActiveVideoMetadata,
} from "@gatewai/remotion-compositions";
import { inject, injectable } from "inversify";
import { VideoCutConfigSchema } from "../shared/config.js";
import type { VideoCutResult } from "../shared/index.js";

@injectable()
export class VideoCutProcessor implements NodeProcessor {
	constructor(
		@inject(TOKENS.GRAPH_RESOLVERS) private graph: GraphResolvers,
	) {}

	async process({
		node,
		data,
	}: BackendNodeProcessorCtx): Promise<BackendNodeProcessorResult<VideoCutResult>> {
		try {
			const videoInputs = this.graph.getInputValuesByType(data, node.id, {
				dataType: DataType.Video,
			});

			const inputVideo = videoInputs[0]?.data as VirtualVideoData | undefined;

			if (!inputVideo) {
				return { success: false, error: "Missing Video input" };
			}

			const config = VideoCutConfigSchema.parse(node.config);
			const activeMeta = getActiveVideoMetadata(inputVideo);

			const durationSec = (activeMeta.durationMs ?? 0) / 1000;
			const endSec = config.endSec ?? durationSec;

			if (config.startSec >= endSec) {
				return { success: false, error: "Start time must be less than end time" };
			}
			if (endSec > durationSec) {
				return { success: false, error: "End time exceeds video duration" };
			}

			const output = appendOperation(inputVideo, {
				op: "cut",
				startSec: config.startSec,
				endSec: config.endSec,
				metadata: {
					...activeMeta,
					durationMs: (endSec - config.startSec) * 1000,
				},
			});

			const outputHandle = data.handles.find(
				(h) => h.nodeId === node.id && h.type === "Output",
			);
			if (!outputHandle) return { success: false, error: "Output handle is missing" };

			const newResult: VideoCutResult = {
				selectedOutputIndex: 0,
				outputs: [
					{
						items: [
							{
								type: DataType.Video,
								data: output,
								outputHandleId: outputHandle.id,
							},
						],
					},
				],
			};

			return { success: true, newResult };
		} catch (err: unknown) {
			return {
				success: false,
				error: err instanceof Error ? err.message : "VideoCut processing failed",
			};
		}
	}
}
