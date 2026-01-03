import fs from "node:fs/promises";
import path from "node:path";
import { DataType } from "@gatewai/db";
import type {
	FileData,
	Output,
	PaintNodeConfig,
	PaintResult,
} from "@gatewai/types";
import sharp from "sharp";
import { logger } from "../../logger.js";
import { logMedia } from "../../media-logger.js";
import {
	bufferToDataUrl,
	getImageBuffer,
	getImageDimensions,
	getMimeType,
} from "../../utils/image.js";
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

		const paintConfig = node.config as PaintNodeConfig;
		const { backgroundColor = "#000", width, height } = paintConfig;

		// Get mask from node's existing result (from painting interaction)
		const existingResult = node.result as unknown as PaintResult;
		const currentOutput =
			existingResult?.outputs?.[existingResult.selectedOutputIndex ?? 0];
		const maskItem = currentOutput?.items?.find(
			(item) => item.type === DataType.Mask,
		);

		// Get output handles
		const outputHandles = data.handles.filter(
			(h) => h.nodeId === node.id && h.type === "Output",
		);
		const imageOutputHandle = outputHandles.find((h) =>
			h.dataTypes.includes(DataType.Image),
		);
		const maskOutputHandle = outputHandles.find((h) =>
			h.dataTypes.includes(DataType.Mask),
		);

		if (!imageOutputHandle || !maskOutputHandle) {
			return { success: false, error: "Missing required output handles" };
		}

		let maskBuffer: Buffer | null = null;
		let maskMetadata: sharp.Metadata | null = null;
		if (maskItem?.data?.processData?.dataUrl) {
			const maskDataUrl = maskItem.data.processData.dataUrl;
			const maskBase64 = maskDataUrl.split(";base64,").pop() ?? "";
			maskBuffer = Buffer.from(maskBase64, "base64");
			maskMetadata = await sharp(maskBuffer).metadata();
		}

		// Determine dimensions and background buffer
		let dimensions: { width: number; height: number };
		let backgroundBuffer: Buffer;
		let mimeType = "image/png"; // Default to PNG for created images

		if (backgroundInput) {
			backgroundBuffer = await getImageBuffer(backgroundInput);
			mimeType = getMimeType(backgroundInput);
			const metadata = await sharp(backgroundBuffer).metadata();
			if (!metadata.width || !metadata.height) {
				return { success: false, error: "Invalid background image dimensions" };
			}
			dimensions = { width: metadata.width, height: metadata.height };
		} else {
			if (width !== undefined && height !== undefined) {
				dimensions = { width, height };
			} else if (maskBuffer && maskMetadata?.width && maskMetadata?.height) {
				dimensions = { width: maskMetadata.width, height: maskMetadata.height };
			} else {
				return {
					success: false,
					error:
						"No dimensions available: no background input, no config dimensions, and no mask",
				};
			}

			// Create solid color background buffer
			backgroundBuffer = await sharp({
				create: {
					width: dimensions.width,
					height: dimensions.height,
					channels: 4,
					background: backgroundColor,
				},
			})
				.png()
				.toBuffer();
		}

		// Process mask: resize if necessary or create transparent if no mask
		let processedMaskBuffer: Buffer;
		if (maskBuffer) {
			processedMaskBuffer = maskBuffer;
			if (
				maskMetadata?.width !== dimensions.width ||
				maskMetadata?.height !== dimensions.height
			) {
				processedMaskBuffer = await sharp(maskBuffer)
					.resize(dimensions.width, dimensions.height)
					.toBuffer();
			}
		} else {
			// Create transparent mask
			processedMaskBuffer = await sharp({
				create: {
					width: dimensions.width,
					height: dimensions.height,
					channels: 4,
					background: { r: 0, g: 0, b: 0, alpha: 0 },
				},
			})
				.png()
				.toBuffer();
		}

		// Composite mask over background (assuming mask has alpha for blending)
		const compositedBuffer = await sharp(backgroundBuffer)
			.composite([{ input: processedMaskBuffer, blend: "over" }])
			.toBuffer();

		// Save images for debug if NODE_ENV is development
		if (process.env.NODE_ENV === "development") {
			const debugDir = path.join(__dirname, "debug_images");
			logger.info(`Saving image output for debug to :${debugDir}`);
			await fs.mkdir(debugDir, { recursive: true });

			const timestamp = Date.now();
			const nodeId = node.id;

			await sharp(backgroundBuffer).toFile(
				path.join(debugDir, `background_${nodeId}_${timestamp}.png`),
			);
			await sharp(processedMaskBuffer).toFile(
				path.join(debugDir, `mask_${nodeId}_${timestamp}.png`),
			);
			await sharp(compositedBuffer).toFile(
				path.join(debugDir, `composited_${nodeId}_${timestamp}.png`),
			);
		}

		// Convert buffers to data URLs
		const imageDataUrl = bufferToDataUrl(compositedBuffer, mimeType);
		const imageDimensions = getImageDimensions(compositedBuffer);
		logMedia(compositedBuffer, ".png", node.id);
		const processedMaskDataUrl = bufferToDataUrl(
			processedMaskBuffer,
			"image/png",
		);
		const maskDimensions = getImageDimensions(processedMaskBuffer);

		// Build new result (cloning existing to preserve history)
		const newResult = structuredClone(
			node.result as unknown as PaintResult,
		) ?? {
			outputs: [],
			selectedOutputIndex: 0,
		};

		const newGeneration: Output = {
			items: [
				{
					type: DataType.Image,
					data: { processData: { dataUrl: imageDataUrl, ...imageDimensions } },
					outputHandleId: imageOutputHandle.id,
				},
				{
					type: DataType.Mask,
					data: {
						processData: { dataUrl: processedMaskDataUrl, ...maskDimensions },
					},
					outputHandleId: maskOutputHandle.id,
				},
			],
		};

		newResult.outputs.push(newGeneration);

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
