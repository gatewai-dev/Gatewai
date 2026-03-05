import assert from "node:assert";
import { TOKENS } from "@gatewai/core/di";
import type { FileData, VirtualMediaData } from "@gatewai/core/types";
import { DataType } from "@gatewai/db";
import type {
	BackendNodeProcessorCtx,
	BackendNodeProcessorResult,
	GraphResolvers,
	MediaService,
	StorageService,
} from "@gatewai/node-sdk/server";
import { AbstractImageProcessor } from "@gatewai/node-sdk/server";
import {
	appendOperation,
	getActiveMediaMetadata,
} from "@gatewai/remotion-compositions/server";
import { inject, injectable } from "inversify";
import { CropNodeConfigSchema } from "../shared/config.js";
import type { CropResult, VideoCropResult } from "../shared/index.js";
import { applyCrop } from "../shared/pixi-crop-run.js";

@injectable()
export class CropProcessor extends AbstractImageProcessor {
	constructor(
		@inject(TOKENS.STORAGE) storage: StorageService,
		@inject(TOKENS.MEDIA) media: MediaService,
		@inject(TOKENS.GRAPH_RESOLVERS) graph: GraphResolvers,
	) {
		super(storage, media, graph);
	}

	protected getPixiRunFunction() {
		return applyCrop;
	}

	protected getPixiExecuteArgs(
		node: BackendNodeProcessorCtx["node"],
		imageUrl: string,
		apiKey?: string,
	) {
		const config = CropNodeConfigSchema.parse(node.config);
		return {
			imageUrl,
			config,
			apiKey,
		};
	}

	protected getImageInput(ctx: BackendNodeProcessorCtx) {
		return (
			this.graph.getInputValue(ctx.data, ctx.node.id, true, {
				dataType: DataType.Image,
				label: "Input",
			})?.data ||
			this.graph.getInputValue(ctx.data, ctx.node.id, true, {
				dataType: DataType.SVG,
				label: "Input",
			})?.data
		) as FileData | null;
	}

	async process(
		ctx: BackendNodeProcessorCtx,
	): Promise<BackendNodeProcessorResult<CropResult | VideoCropResult>> {
		try {
			const { node, data } = ctx;
			const imageInput = this.getImageInput(ctx);
			const videoInputsOnly = this.graph.getInputValuesByType(data, node.id, {
				dataType: DataType.Video,
			});
			const audioInputsOnly = this.graph.getInputValuesByType(data, node.id, {
				dataType: DataType.Audio,
			});

			const videoInputs = [...videoInputsOnly, ...audioInputsOnly];

			const hasImage = imageInput;
			const hasVideo = videoInputs[0]?.data;

			if (!hasImage && !hasVideo) {
				return { success: false, error: "Missing Image or Video input" };
			}

			const config = CropNodeConfigSchema.parse(node.config);

			if (hasVideo) {
				return this.processVideo(
					hasVideo as VirtualMediaData,
					videoInputs[0]!.type as "Video" | "Audio",
					config,
					data,
					node,
				);
			} else {
				return super.process(ctx);
			}
		} catch (err: unknown) {
			return {
				success: false,
				error: err instanceof Error ? err.message : "Crop processing failed",
			};
		}
	}

	private async processVideo(
		inputVideo: VirtualMediaData,
		inputVideoType: "Video" | "Audio",
		config: typeof import("../shared/config.js").CropNodeConfigSchema._type,
		data: BackendNodeProcessorCtx["data"],
		node: BackendNodeProcessorCtx["node"],
	): Promise<BackendNodeProcessorResult<VideoCropResult>> {
		const activeMeta = getActiveMediaMetadata(inputVideo);
		if (!activeMeta || !activeMeta.width || !activeMeta.height) {
			return { success: false, error: "No active media metadata found" };
		}
		const sw = activeMeta.width;
		const sh = activeMeta.height;
		const cw = Math.max(1, Math.round((config.widthPercentage / 100) * sw));
		const ch = Math.max(1, Math.round((config.heightPercentage / 100) * sh));

		const output = appendOperation(inputVideo, {
			op: "crop",
			leftPercentage: config.leftPercentage,
			topPercentage: config.topPercentage,
			widthPercentage: config.widthPercentage,
			heightPercentage: config.heightPercentage,
			metadata: {
				...activeMeta,
				width: cw,
				height: ch,
			},
		});

		const outputHandle = data.handles.find(
			(h) => h.nodeId === node.id && h.type === "Output",
		);
		if (!outputHandle) return { success: false, error: "Output handle is missing" };

		const newResult: VideoCropResult = {
			selectedOutputIndex: 0,
			outputs: [
				{
					items: [
						{
							type: inputVideoType,
							data: output,
							outputHandleId: outputHandle.id,
						},
					],
				},
			],
		};

		return { success: true, newResult };
	}
}
