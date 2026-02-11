import assert from "node:assert";
import { DataType } from "@gatewai/db";
import type {
	BackendNodeProcessorCtx,
	BackendNodeProcessorResult,
	NodeProcessor,
} from "@gatewai/node-sdk";
import {
	type FileData,
	type NodeResult,
	type ResizeResult,
} from "@gatewai/types";
import { ResizeNodeConfigSchema } from "../../configs/resize.config.js";
import { TOKENS } from "@gatewai/node-sdk";
import { inject, injectable } from "tsyringe";
import type {
	GraphResolvers,
	MediaService,
	StorageService,
} from "@gatewai/node-sdk";

@injectable()
export default class ResizeProcessor implements NodeProcessor {
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
			const imageInput = this.graph.getInputValue(data, node.id, true, {
				dataType: DataType.Image,
				label: "Image",
			})?.data as FileData | null;

			assert(imageInput);
			const arrayBuffer = await this.graph.loadMediaBuffer(imageInput);
			const buffer = Buffer.from(arrayBuffer);
			const base64Data = this.media.bufferToDataUrl(buffer, "image/png");

			const resizeConfig = ResizeNodeConfigSchema.parse(node.config);

			const { dataUrl, ...dimensions } =
				await this.media.backendPixiService.processResize(
					base64Data,
					{
						width: resizeConfig.width ?? 512,
						height: resizeConfig.height ?? 512,
					},
					undefined,
					data.apiKey,
				);

			const uploadBuffer = Buffer.from(await dataUrl.arrayBuffer());
			const mimeType = dataUrl.type;

			const outputHandle = data.handles.find(
				(h) => h.nodeId === node.id && h.type === "Output",
			);
			if (!outputHandle)
				return { success: false, error: "Output handle is missing." };

			const newResult: NodeResult = structuredClone(
				node.result as NodeResult,
			) ?? {
				outputs: [],
				selectedOutputIndex: 0,
			};

			const key = `${(data.task ?? node).id}/${Date.now()}.png`;
			const { signedUrl, key: tempKey } = await this.storage.uploadToTemporaryFolder(
				uploadBuffer,
				mimeType,
				key,
			);

			const newGeneration: ResizeResult["outputs"][number] = {
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
			newResult.selectedOutputIndex = newResult.outputs.length - 1;

			return { success: true, newResult };
		} catch (err: unknown) {
			return {
				success: false,
				error: err instanceof Error ? err.message : "Resize processing failed",
			};
		}
	}
}
