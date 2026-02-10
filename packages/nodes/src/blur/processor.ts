import assert from "node:assert";
import { DataType } from "@gatewai/db";
import type { BackendNodeProcessor } from "@gatewai/node-sdk";
import type { BlurInput, BlurOutput } from "@gatewai/pixi-processor";
import {
	BlurNodeConfigSchema,
	type BlurResult,
	type FileData,
	type NodeResult,
} from "@gatewai/types";

const blurProcessor: BackendNodeProcessor = async ({
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
		const blurConfig = BlurNodeConfigSchema.parse(node.config);
		const blurSize = blurConfig.size ?? 0;

		const { dataUrl, ...dimensions } =
			await services.backendPixiService.execute<BlurInput, BlurOutput>(
				"blur",
				{
					imageUrl,
					options: { blurSize },
					apiKey: data.apiKey,
				},
				undefined,
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

		const newGeneration: BlurResult["outputs"][number] = {
			items: [
				{
					type: DataType.Image,
					data: {
						processData: {
							dataUrl: signedUrl,
							tempKey,
							mimeType: mimeType,
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
			error: err instanceof Error ? err.message : "Blur processing failed",
		};
	}
};

export default blurProcessor;
