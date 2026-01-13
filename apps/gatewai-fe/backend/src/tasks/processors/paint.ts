import assert from "node:assert";
import { DataType } from "@gatewai/db";
import {
	type FileData,
	type NodeResult,
	PaintNodeConfigSchema,
	type PaintResult,
} from "@gatewai/types";
import parseDataUrl from "data-urls";
import { ENV_CONFIG } from "../../config.js";
import { logger } from "../../logger.js";
import { backendPixiService } from "../../media/pixi-processor.js";
import { logImage } from "../../media-logger.js";
import { ResolveFileDataUrl } from "../../utils/misc.js";
import { uploadToTemporaryFolder } from "../../utils/storage.js";
import { getInputValue } from "../resolvers.js";
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
			imageUrl = ResolveFileDataUrl(backgroundInput) ?? undefined;
		}

		const { imageWithMask, onlyMask } = await backendPixiService.processMask(
			paintConfig,
			imageUrl,
			paintConfig.paintData,
		);

		const { dataUrl: imageDataUrl, ...imageDimensions } = imageWithMask;
		const { dataUrl: maskDataUrl, ...maskDimensions } = onlyMask;

		const parsedImage = parseDataUrl(imageDataUrl);
		assert(parsedImage?.body.buffer);
		if (ENV_CONFIG.DEBUG_LOG_MEDIA) {
			logImage(Buffer.from(parsedImage.body.buffer), ".png", node.id);
		}

		const parsedMask = parseDataUrl(maskDataUrl);
		assert(parsedMask?.body.buffer);
		if (ENV_CONFIG.DEBUG_LOG_MEDIA) {
			logImage(Buffer.from(parsedMask.body.buffer), ".png", `${node.id}_mask`);
		}

		const newResult: NodeResult = structuredClone(
			node.result as NodeResult,
		) ?? {
			outputs: [],
			selectedOutputIndex: 0,
		};

		const now = Date.now();

		const imageBuffer = Buffer.from(parsedImage.body.buffer);
		const imageKey = `${node.id}/${now}.png`;
		const { signedUrl: imageSignedUrl } = await uploadToTemporaryFolder(
			imageBuffer,
			parsedImage.mimeType.toString(),
			imageKey,
		);

		const maskBuffer = Buffer.from(parsedMask.body.buffer);
		const maskKey = `${node.id}/${now}_mask.png`;
		const { signedUrl: maskSignedUrl } = await uploadToTemporaryFolder(
			maskBuffer,
			parsedMask.mimeType.toString(),
			maskKey,
		);

		const imageProcessData = { dataUrl: imageSignedUrl, ...imageDimensions };
		const maskProcessData = { dataUrl: maskSignedUrl, ...maskDimensions };

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
