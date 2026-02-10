import type { NodeServices } from "@gatewai/node-sdk";
import type { FileData } from "@gatewai/types";
import { ENV_CONFIG } from "@gatewai/core";
import { backendPixiService } from "../media/pixi-service.js";
import {
	bufferToDataUrl,
	getImageBuffer,
	getImageDimensions,
} from "../utils/image.js";
import { ResolveFileDataUrl } from "../utils/misc.js";
import {
	generateSignedUrl,
	getFromGCS,
	getObjectMetadata,
	uploadToGCS,
	uploadToTemporaryFolder,
} from "../utils/storage.js";
import {
	getAllInputValuesWithHandle,
	getAllOutputHandles,
	getInputValue,
	getInputValuesByType,
	loadMediaBuffer,
} from "./resolvers.js";

// Helper to match the interface expected by NodeServices
const resolveFileDataUrl = async (data: FileData | null) => {
	const result = ResolveFileDataUrl(data);
	return result || null;
};

// Helper to match the interface expected by NodeServices
const getFileDataMimeType = async (fileData: FileData) => {
	if (fileData?.entity?.mimeType) return fileData?.entity?.mimeType;
	if (fileData?.processData?.mimeType) return fileData?.processData?.mimeType;
	if (fileData?.processData?.tempKey) {
		const metadata = await getObjectMetadata(fileData?.processData?.tempKey);
		return metadata.contentType || null;
	}
	return null;
};

/**
 * Implementation of the NodeServices interface.
 * Aggregates all backend services to be injected into node processors.
 */
export const nodeServices: NodeServices = {
	// ── Graph Resolvers ───────────────────────────────────────────────────────
	getInputValue,
	getInputValuesByType,
	getAllOutputHandles,
	getAllInputValuesWithHandle,
	loadMediaBuffer,
	getFileDataMimeType,

	// ── Storage ───────────────────────────────────────────────────────────────
	uploadToTemporaryFolder,
	uploadToGCS,
	generateSignedUrl,
	getFromGCS,

	// ── Media Processing ──────────────────────────────────────────────────────
	backendPixiService,
	getImageDimensions,
	getImageBuffer,
	resolveFileDataUrl,
	bufferToDataUrl,

	env: ENV_CONFIG,
};
