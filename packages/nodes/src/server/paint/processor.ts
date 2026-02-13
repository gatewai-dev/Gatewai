import { logger } from "@gatewai/core";
import { TOKENS } from "@gatewai/core/di";
import type { FileData, PaintResult } from "@gatewai/core/types";
import { DataType } from "@gatewai/db";
import type {
	BackendNodeProcessorCtx,
	BackendNodeProcessorResult,
	GraphResolvers,
	MediaService,
	NodeProcessor,
	StorageService,
} from "@gatewai/node-sdk";
import { inject, injectable } from "tsyringe";
import { PaintNodeConfigSchema } from "../../node-configs.schema.js";

@injectable()
export default class PaintProcessor implements NodeProcessor {
	constructor(
		@inject(TOKENS.STORAGE) private storage: StorageService,
		@inject(TOKENS.MEDIA) private media: MediaService,
		@inject(TOKENS.GRAPH_RESOLVERS) private graph: GraphResolvers,
	) { }

	async process({
		node,
		data,
	}: BackendNodeProcessorCtx): Promise<BackendNodeProcessorResult> {
		try {
			logger.info(`Processing node ${node.id} of type ${node.type}`);

			const backgroundInput = this.graph.getInputValue(data, node.id, false, {
				dataType: DataType.Image,
				label: "Background Image",
			})?.data as FileData | null;

			const paintConfig = PaintNodeConfigSchema.parse(node.config);

			const outputHandles = data.handles.filter(
				(h) => h.nodeId === node.id && h.type === "Output",
			);
			const imageOutputHandle = outputHandles.find((h) =>
				h.label.includes("Image"),
			);
			const maskOutputHandle = outputHandles.find((h) =>
				h.label.includes("Mask"),
			);

			if (!imageOutputHandle || !maskOutputHandle) {
				return { success: false, error: "Missing required output handles" };
			}

			let imageUrl: string | undefined;

			if (backgroundInput) {
				const arrayBuffer = await this.graph.loadMediaBuffer(backgroundInput);
				const buffer = Buffer.from(arrayBuffer);
				imageUrl = this.media.bufferToDataUrl(buffer, "image/png");
			}

			const { imageWithMask, onlyMask } =
				await this.media.backendPixiService.processMask(
					paintConfig,
					imageUrl,
					paintConfig.paintData,
					undefined,
					data.apiKey,
				);

			const { dataUrl: imageDataUrl, ...imageDimensions } = imageWithMask;
			const { dataUrl: maskDataUrl, ...maskDimensions } = onlyMask;

			const imageBuffer = Buffer.from(await imageDataUrl.arrayBuffer());
			const imageMimeType = imageDataUrl.type;

			const maskBuffer = Buffer.from(await maskDataUrl.arrayBuffer());
			const maskMimeType = maskDataUrl.type;

			const newResult: PaintResult = structuredClone(
				node.result as PaintResult,
			) ?? {
				outputs: [],
				selectedOutputIndex: 0,
			};

			const now = Date.now();

			const imageKey = `${node.id}/${now}.png`;
			const { signedUrl: imageSignedUrl, key: tempImageKey } =
				await this.storage.uploadToTemporaryStorageFolder(
					imageBuffer,
					imageMimeType,
					imageKey,
				);

			const maskKey = `${node.id}/${now}_mask.png`;
			const { signedUrl: maskSignedUrl, key: tempMaskKey } =
				await this.storage.uploadToTemporaryStorageFolder(
					maskBuffer,
					maskMimeType,
					maskKey,
				);

			const imageProcessData = {
				dataUrl: imageSignedUrl,
				tempKey: tempImageKey,
				mimeType: imageMimeType,
				...imageDimensions,
			};
			const maskProcessData = {
				dataUrl: maskSignedUrl,
				tempKey: tempMaskKey,
				mimeType: maskMimeType,
				...maskDimensions,
			};

			const newGeneration: PaintResult["outputs"][number] = {
				items: [
					{
						type: DataType.Image,
						data: { processData: imageProcessData },
						outputHandleId: imageOutputHandle.id,
					},
					{
						type: DataType.Image,
						data: { processData: maskProcessData },
						outputHandleId: maskOutputHandle.id,
					},
				],
			};

			newResult.outputs = [newGeneration];
			newResult.selectedOutputIndex = 0;

			return { success: true, newResult };
		} catch (err: unknown) {
			return {
				success: false,
				error: err instanceof Error ? err.message : "Paint processing failed",
			};
		}
	}
}
