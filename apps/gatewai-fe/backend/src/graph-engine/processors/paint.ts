import { DataType } from "@gatewai/db";
import {
	type FileData,
	type NodeResult,
	PaintNodeConfigSchema,
	type PaintResult,
} from "@gatewai/types";

import { ENV_CONFIG } from "../../config.js";
import { logger } from "../../logger.js";
import { backendPixiService } from "../../media/pixi-service.js";
import { logImage } from "../../media-logger.js";
import { bufferToDataUrl } from "../../utils/image.js";
import { uploadToTemporaryFolder } from "../../utils/storage.js";
import { getInputValue, loadMediaBuffer } from "../resolvers.js";
import type { NodeProcessor } from "./types.js";

const paintProcessor: NodeProcessor = async ({ node, data }) => {
	try {
		logger.info(`Processing node ${node.id} of type ${node.type}`);
		// Get optional background image input
		const backgroundInput = getInputValue(data, node.id, false, {
			dataType: DataType.Image,
			label: "Background Image",
		})?.data as FileData | null;

		const paintConfig = PaintNodeConfigSchema.parse(node.config);

		// Get output handles
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
			const arrayBuffer = await loadMediaBuffer(backgroundInput);
			const buffer = Buffer.from(arrayBuffer);
			imageUrl = bufferToDataUrl(buffer, "image/png");
		}

		const { imageWithMask, onlyMask } = await backendPixiService.processMask(
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

		if (ENV_CONFIG.DEBUG_LOG_MEDIA) {
			logImage(imageBuffer, ".png", node.id);
		}

		const maskBuffer = Buffer.from(await maskDataUrl.arrayBuffer());
		const maskMimeType = maskDataUrl.type;

		if (ENV_CONFIG.DEBUG_LOG_MEDIA) {
			logImage(maskBuffer, ".png", `${node.id}_mask`);
		}

		const newResult: NodeResult = structuredClone(
			node.result as NodeResult,
		) ?? {
			outputs: [],
			selectedOutputIndex: 0,
		};

		const now = Date.now();

		const imageKey = `${node.id}/${now}.png`;
		const { signedUrl: imageSignedUrl, key: tempImageKey } =
			await uploadToTemporaryFolder(imageBuffer, imageMimeType, imageKey);

		const maskKey = `${node.id}/${now}_mask.png`;
		const { signedUrl: maskSignedUrl, key: tempMaskKey } =
			await uploadToTemporaryFolder(maskBuffer, maskMimeType, maskKey);

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
		console.log({ err });
		return {
			success: false,
			error: err instanceof Error ? err.message : "Paint processing failed",
		};
	}
};

export default paintProcessor;
