import assert from "node:assert";
import { DataType } from "@gatewai/db";
import type { BackendNodeProcessor } from "@gatewai/node-sdk";
import {
	CropNodeConfigSchema,
	type CropResult,
	type FileData,
	type NodeResult,
} from "@gatewai/types";

const cropProcessor: BackendNodeProcessor = async ({
	node,
	data,
	services,
}) => {
	try {
		const imageInput = services.getInputValue(data, node.id, true, {
			dataType: DataType.Image,
			label: "Image",
		})?.data as FileData | null;

		assert(imageInput);
		const imageUrl = await services.resolveFileDataUrl(imageInput);
		assert(imageUrl);

		const cropConfig = CropNodeConfigSchema.parse(node.config);

		const { dataUrl, ...dimensions } =
			await services.backendPixiService.processCrop(
				imageUrl,
				{
					leftPercentage: cropConfig.leftPercentage ?? 0,
					topPercentage: cropConfig.topPercentage ?? 0,
					widthPercentage: cropConfig.widthPercentage ?? 0,
					heightPercentage: cropConfig.heightPercentage ?? 0,
				},
				undefined,
				data.apiKey,
			);

		const uploadBuffer = Buffer.from(await dataUrl.arrayBuffer());
		const mimeType = dataUrl.type;

		if (services.env.DEBUG_LOG_MEDIA) {
			services.logImage(uploadBuffer, ".png", node.id);
		}

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
		const { signedUrl, key: tempKey } = await services.uploadToTemporaryFolder(
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
		newResult.selectedOutputIndex = newResult.outputs.length - 1;

		return { success: true, newResult };
	} catch (err: unknown) {
		return {
			success: false,
			error: err instanceof Error ? err.message : "Crop processing failed",
		};
	}
};

export default cropProcessor;
