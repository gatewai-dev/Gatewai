import { logger } from "@gatewai/core";
import { DataType } from "@gatewai/db";
import type { BackendNodeProcessor } from "@gatewai/node-sdk";
import {
	type FileData,
	type NodeResult,
	PaintNodeConfigSchema,
	type PaintResult,
} from "@gatewai/types";

const paintProcessor: BackendNodeProcessor = async ({
	node,
	data,
	services,
}) => {
	try {
		logger.info(`Processing node ${node.id} of type ${node.type}`);

		const backgroundInput = services.getInputValue(data, node.id, false, {
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
			const arrayBuffer = await services.loadMediaBuffer(backgroundInput);
			const buffer = Buffer.from(arrayBuffer);
			imageUrl = services.bufferToDataUrl(buffer, "image/png");
		}

		const { imageWithMask, onlyMask } =
			await services.backendPixiService.processMask(
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

		const newResult: NodeResult = structuredClone(
			node.result as NodeResult,
		) ?? {
			outputs: [],
			selectedOutputIndex: 0,
		};

		const now = Date.now();

		const imageKey = `${node.id}/${now}.png`;
		const { signedUrl: imageSignedUrl, key: tempImageKey } =
			await services.uploadToTemporaryFolder(
				imageBuffer,
				imageMimeType,
				imageKey,
			);

		const maskKey = `${node.id}/${now}_mask.png`;
		const { signedUrl: maskSignedUrl, key: tempMaskKey } =
			await services.uploadToTemporaryFolder(maskBuffer, maskMimeType, maskKey);

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
		newResult.selectedOutputIndex = newResult.outputs.length - 1;

		return { success: true, newResult };
	} catch (err: unknown) {
		return {
			success: false,
			error: err instanceof Error ? err.message : "Paint processing failed",
		};
	}
};

export default paintProcessor;
