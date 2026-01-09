import { DataType } from "@gatewai/db";
import {
	type FileData,
	type Output,
	PaintNodeConfigSchema,
	type PaintResult,
} from "@gatewai/types";
import parseDataUrl from "data-urls";
import { logger } from "../../logger.js";
import { backendPixiService } from "../../media/pixi-processor.js";
import { logImage } from "../../media-logger.js";
import { ResolveFileDataUrl } from "../../utils/misc.js";
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
			h.dataTypes.includes(DataType.Image),
		);
		const maskOutputHandle = outputHandles.find((h) =>
			h.dataTypes.includes(DataType.Mask),
		);

		if (!imageOutputHandle || !maskOutputHandle) {
			return { success: false, error: "Missing required output handles" };
		}

		let imageUrl: string | undefined;

		if (backgroundInput) {
			imageUrl = ResolveFileDataUrl(backgroundInput);
		}

		const { imageWithMask, onlyMask } = await backendPixiService.processMask(
			paintConfig,
			imageUrl,
			paintConfig.paintData,
		);

		const newResult = structuredClone(
			node.result as unknown as PaintResult,
		) ?? {
			outputs: [],
			selectedOutputIndex: 0,
		};

		const parsed = parseDataUrl(imageWithMask.dataUrl);
		if (parsed?.body.buffer) {
			logImage(Buffer.from(parsed?.body.buffer), ".png", node.id);
		}

		const parsedMask = parseDataUrl(onlyMask.dataUrl);
		if (parsedMask?.body.buffer) {
			logImage(Buffer.from(parsedMask?.body.buffer), ".png", `${node.id}_mask`);
		}

		const newGeneration: Output = {
			items: [
				{
					type: DataType.Image,
					data: { processData: imageWithMask },
					outputHandleId: imageOutputHandle.id,
				},
				{
					type: DataType.Mask,
					data: {
						processData: onlyMask,
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
