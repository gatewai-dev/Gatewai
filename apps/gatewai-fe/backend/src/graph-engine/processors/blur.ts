import assert from "node:assert";
import { DataType } from "@gatewai/db";
import {
	BlurNodeConfigSchema,
	type BlurResult,
	type FileData,
	type NodeResult,
} from "@gatewai/types";

import { ENV_CONFIG } from "../../config.js";
import { backendPixiService } from "../../media/pixi-processor.js";
import { logImage } from "../../media-logger.js";
import { ResolveFileDataUrl } from "../../utils/misc.js";
import { uploadToTemporaryFolder } from "../../utils/storage.js";
import { getInputValue } from "../resolvers.js";
import type { NodeProcessor } from "./types.js";

const blurProcessor: NodeProcessor = async ({ node, data }) => {
	try {
		const imageInput = getInputValue(data, node.id, true, {
			dataType: DataType.Image,
			label: "Image",
		})?.data as FileData | null;

		assert(imageInput);
		const imageUrl = await ResolveFileDataUrl(imageInput);
		assert(imageUrl);
		const blurConfig = BlurNodeConfigSchema.parse(node.config);
		const blurSize = blurConfig.size ?? 0;

		const { dataUrl, ...dimensions } = await backendPixiService.processBlur(
			imageUrl,
			{
				blurSize,
			},
		);

		const uploadBuffer = Buffer.from(await dataUrl.arrayBuffer());
		const mimeType = dataUrl.type;

		if (ENV_CONFIG.DEBUG_LOG_MEDIA) {
			logImage(uploadBuffer, ".png", node.id);
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
		const { signedUrl, key: tempKey } = await uploadToTemporaryFolder(
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
		console.log(err);
		return {
			success: false,
			error: err instanceof Error ? err.message : "Blur processing failed",
		};
	}
};

export default blurProcessor;
