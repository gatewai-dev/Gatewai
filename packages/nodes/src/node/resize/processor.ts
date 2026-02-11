import assert from "node:assert";
import {
	type FileData,
	type NodeResult,
	ResizeNodeConfigSchema,
	type ResizeResult,
} from "@gatewai/core/types";
import { DataType } from "@gatewai/db";
import type {
	BackendNodeProcessorCtx,
	BackendNodeProcessorResult,
	NodeProcessor,
} from "@gatewai/node-sdk";
import { injectable } from "tsyringe";

@injectable()
export default class ResizeProcessor implements NodeProcessor {
	async process({
		node,
		data,
		graph,
		storage,
		media,
	}: BackendNodeProcessorCtx): Promise<BackendNodeProcessorResult> {
		try {
			const imageInput = graph.getInputValue(data, node.id, true, {
				dataType: DataType.Image,
				label: "Image",
			})?.data as FileData | null;

			assert(imageInput);
			const arrayBuffer = await graph.loadMediaBuffer(imageInput);
			const buffer = Buffer.from(arrayBuffer);
			const base64Data = media.bufferToDataUrl(buffer, "image/png");

			const resizeConfig = ResizeNodeConfigSchema.parse(node.config);

			const { dataUrl, ...dimensions } =
				await media.backendPixiService.processResize(
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
			const { signedUrl, key: tempKey } = await storage.uploadToTemporaryFolder(
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
