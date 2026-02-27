import assert from "node:assert";
import { TOKENS } from "@gatewai/core/di";
import type { FileData, VirtualMediaData } from "@gatewai/core/types";
import { DataType } from "@gatewai/db";
import type {
	BackendNodeProcessorCtx,
	BackendNodeProcessorResult,
	GraphResolvers,
	MediaService,
	NodeProcessor,
	StorageService,
} from "@gatewai/node-sdk/server";
import {
	appendOperation,
	getActiveMediaMetadata,
} from "@gatewai/remotion-compositions/server";
import { inject, injectable } from "inversify";
import { CropNodeConfigSchema } from "../shared/config.js";
import type { CropResult, VideoCropResult } from "../shared/index.js";
import { applyCrop } from "../shared/pixi-crop-run.js";

@injectable()
export class CropProcessor implements NodeProcessor {
	constructor(
		@inject(TOKENS.STORAGE) private storage: StorageService,
		@inject(TOKENS.MEDIA) private media: MediaService,
		@inject(TOKENS.GRAPH_RESOLVERS) private graph: GraphResolvers,
	) { }

	async process({
		node,
		data,
	}: BackendNodeProcessorCtx): Promise<BackendNodeProcessorResult<CropResult | VideoCropResult>> {
		try {
			const imageInput =
				this.graph.getInputValue(data, node.id, true, {
					dataType: DataType.Image,
					label: "Input",
				}) ||
				this.graph.getInputValue(data, node.id, true, {
					dataType: DataType.SVG,
					label: "Input",
				});
			const videoInputsOnly = this.graph.getInputValuesByType(data, node.id, {
				dataType: DataType.Video,
			});
			const audioInputsOnly = this.graph.getInputValuesByType(data, node.id, {
				dataType: DataType.Audio,
			});

			const videoInputs = [...videoInputsOnly, ...audioInputsOnly];

			const hasImage = imageInput?.data;
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
				return this.processImage(imageInput!.data as FileData, config, data, node);
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
		const sw = activeMeta?.width ?? 1920;
		const sh = activeMeta?.height ?? 1080;
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

	private async processImage(
		imageInput: FileData,
		config: typeof import("../shared/config.js").CropNodeConfigSchema._type,
		data: BackendNodeProcessorCtx["data"],
		node: BackendNodeProcessorCtx["node"],
	): Promise<BackendNodeProcessorResult<CropResult>> {
		assert(imageInput);
		const imageUrl = await this.media.resolveFileDataUrl(imageInput);
		assert(imageUrl);

		const { dataUrl, ...dimensions } = await this.media.backendPixiService.execute(
			node.id,
			{
				imageUrl,
				config,
				apiKey: data.apiKey,
			},
			applyCrop,
		);

		const uploadBuffer = Buffer.from(await dataUrl.arrayBuffer());
		const mimeType = dataUrl.type;

		const outputHandle = data.handles.find(
			(h) => h.nodeId === node.id && h.type === "Output",
		);
		if (!outputHandle)
			return { success: false, error: "Output handle is missing." };

		const newResult: CropResult = structuredClone(
			node.result as unknown as CropResult,
		) ?? {
			outputs: [],
			selectedOutputIndex: 0,
		};

		const key = `${(data.task ?? node).id}/${Date.now()}.png`;
		const { signedUrl, key: tempKey } =
			await this.storage.uploadToTemporaryStorageFolder(
				uploadBuffer,
				mimeType,
				key,
			);

		const newGeneration: CropResult["outputs"][number] = {
			items: [
				{
					type: DataType.Image,
					data: {
						processData: {
							dataUrl: signedUrl,
							tempKey,
							mimeType,
							...dimensions,
						},
					},
					outputHandleId: outputHandle.id,
				},
			],
		};

		newResult.outputs = [newGeneration];
		newResult.selectedOutputIndex = 0;

		return { success: true, newResult };
	}
}
