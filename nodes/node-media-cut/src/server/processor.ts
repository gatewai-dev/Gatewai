import { TOKENS } from "@gatewai/core/di";
import type { VirtualMediaData } from "@gatewai/core/types";
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
} from "@gatewai/remotion-compositions/server";
import { inject, injectable } from "inversify";
import { MediaCutConfigSchema } from "../shared/config.js";
import type { MediaCutResult } from "../shared/index.js";

@injectable()
export class MediaCutProcessor implements NodeProcessor {
	constructor(
		@inject(TOKENS.GRAPH_RESOLVERS) private graph: GraphResolvers,
	) { }

	async process({
		node,
		data,
	}: BackendNodeProcessorCtx): Promise<BackendNodeProcessorResult<MediaCutResult>> {
		try {
			const videoInputs = this.graph.getInputValuesByType(data, node.id, {
				dataType: DataType.Video,
			});
			const audioInputs = this.graph.getInputValuesByType(data, node.id, {
				dataType: DataType.Audio,
			});

			const connectedInput = videoInputs[0] ?? audioInputs[0];
			const inputMedia = connectedInput?.data as VirtualMediaData | undefined;

			if (!connectedInput || !inputMedia) {
				return { success: false, error: "Missing Video or Audio input" };
			}

			if (videoInputs.length > 1 && audioInputs.length > 0) {
				return { success: false, error: "Cannot connect both Video and Audio inputs. Please connect only one." };
			}

			const config = MediaCutConfigSchema.parse(node.config);
			const activeMeta = getActiveVideoMetadata(inputMedia);

			if (!activeMeta) {
				return { success: false, error: "Unable to read media metadata" };
			}

			const durationMs = activeMeta.durationMs ?? 0;

			if (durationMs <= 0) {
				return { success: false, error: "Media duration is unknown or zero" };
			}

			let startMs = config.startSec * 1000;
			let endMs = config.endSec ? config.endSec * 1000 : durationMs;

			if (startMs < 0 || endMs > durationMs || endMs <= startMs) {
				startMs = 0;
				endMs = durationMs;
			}

			const output = appendOperation(inputMedia, {
				op: "cut",
				startSec: startMs / 1000,
				endSec: endMs / 1000,
				metadata: {
					...activeMeta,
					durationMs: endMs - startMs,
				},
			});

			const outputHandle = data.handles.find(
				(h) => h.nodeId === node.id && h.type === "Output",
			);
			if (!outputHandle) return { success: false, error: "Output handle is missing" };

			const inputType = connectedInput.type as "Video" | "Audio";
			const newResult: MediaCutResult = {
				selectedOutputIndex: 0,
				outputs: [
					{
						items: [
							{
								type: inputType,
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
				error: err instanceof Error ? err.message : "MediaCut processing failed",
			};
		}
	}
}
