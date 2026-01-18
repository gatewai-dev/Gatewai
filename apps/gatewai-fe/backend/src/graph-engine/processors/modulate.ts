import assert from "node:assert";
import { DataType } from "@gatewai/db";
import type {
	FileData,
	ModulateNodeConfig,
	ModulateResult,
	NodeResult,
} from "@gatewai/types";

import { ENV_CONFIG } from "../../config.js";
import { backendPixiService } from "../../media/pixi-processor.js";
import { logImage } from "../../media-logger.js";
import { bufferToDataUrl } from "../../utils/image.js";
import { uploadToTemporaryFolder } from "../../utils/storage.js";
import { getInputValue, loadMediaBuffer } from "../resolvers.js";
import type { NodeProcessor } from "./types.js";

const modulateProcessor: NodeProcessor = async ({ node, data }) => {
	try {
		const imageInput = getInputValue(data, node.id, true, {
			dataType: DataType.Image,
			label: "Image",
		})?.data as FileData | null;
		const modulateConfig = node.config as ModulateNodeConfig;

		if (!imageInput) {
			return { success: false, error: "No image input provided" };
		}

		const arrayBuffer = await loadMediaBuffer(imageInput);
		const buffer = Buffer.from(arrayBuffer);
		const base64Data = bufferToDataUrl(buffer, "image/png");

		const { dataUrl, ...dimensions } = await backendPixiService.processModulate(
			base64Data,
			modulateConfig,
		);

		const uploadBuffer = Buffer.from(await dataUrl.arrayBuffer());
		const mimeType = dataUrl.type;

		if (ENV_CONFIG.DEBUG_LOG_MEDIA) {
			logImage(uploadBuffer, ".png", node.id);
		}
		// Build new result (similar to LLM)
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
		const { signedUrl, key: tempKey } = await uploadToTemporaryFolder(
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
			error: err instanceof Error ? err.message : "Modulate processing failed",
		};
	}
};

export default modulateProcessor;
