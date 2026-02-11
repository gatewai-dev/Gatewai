import { DataType } from "@gatewai/db";
import type {
	BackendNodeProcessorCtx,
	BackendNodeProcessorResult,
	NodeProcessor,
} from "@gatewai/node-sdk";
import {
	type FileData,
	type ModulateResult,
	type NodeResult,
} from "@gatewai/types";
import { ModulateNodeConfigSchema } from "../../configs/modulate.config.js";
import type { ModulateNodeConfig } from "../../configs/modulate.config.js";
import { TOKENS } from "@gatewai/node-sdk";
import { inject, injectable } from "tsyringe";
import type {
	GraphResolvers,
	MediaService,
	StorageService,
} from "@gatewai/node-sdk";

@injectable()
export default class ModulateProcessor implements NodeProcessor {
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
			const modulateConfig = node.config as ModulateNodeConfig;

			if (!imageInput) {
				return { success: false, error: "No image input provided" };
			}

			const arrayBuffer = await this.graph.loadMediaBuffer(imageInput);
			const buffer = Buffer.from(arrayBuffer);
			const base64Data = this.media.bufferToDataUrl(buffer, "image/png");

			const { dataUrl, ...dimensions } =
				await this.media.backendPixiService.processModulate(
					base64Data,
					modulateConfig,
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

			const key = `${node.id}/${Date.now()}.png`;
			const { signedUrl, key: tempKey } = await this.storage.uploadToTemporaryFolder(
				uploadBuffer,
				mimeType,
				key,
			);

			const newGeneration: ModulateResult["outputs"][number] = {
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
				error:
					err instanceof Error ? err.message : "Modulate processing failed",
			};
		}
	}
}
