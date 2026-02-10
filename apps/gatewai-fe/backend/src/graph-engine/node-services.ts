import type { NodeServices } from "@gatewai/node-sdk";
import { ENV_CONFIG } from "@gatewai/core";
import { ServerMediaService } from "@gatewai/media";
import { GCSStorageService } from "@gatewai/storage";
import {
	getAllInputValuesWithHandle,
	getAllOutputHandles,
	getFileDataMimeType,
	getInputValue,
	getInputValuesByType,
	loadMediaBuffer,
} from "./resolvers.js";

// Instantiate Services
export const storageService = new GCSStorageService({
	googleClientId: ENV_CONFIG.GOOGLE_CLIENT_ID,
	gcsAssetsBucket: ENV_CONFIG.GCS_ASSETS_BUCKET,
	googleApplicationCredentialsPath: ENV_CONFIG.GOOGLE_APPLICATION_CREDENTIALS_PATH,
});

export const mediaService = new ServerMediaService(ENV_CONFIG.BASE_URL);

/**
 * Graph resolvers implementation using the storage service where needed.
 */
export const graphResolvers = {
	getInputValue,
	getInputValuesByType,
	getAllOutputHandles,
	getAllInputValuesWithHandle,
	loadMediaBuffer: (fileData: any) => loadMediaBuffer(storageService, fileData),
	getFileDataMimeType: (fileData: any) => getFileDataMimeType(storageService, fileData),
};

/**
 * Implementation of the NodeServices interface.
 * Aggregates all backend services to be injected into node processors.
 * 
 * Adapts the new class-based services to the flat NodeServices interface
 * required by legacy node processors and the DI contract.
 * @deprecated Use specific services (storageService, mediaService, graphResolvers) via DI.
 */
export const nodeServices: NodeServices = {
	// ── Graph Resolvers ───────────────────────────────────────────────────────
	...graphResolvers,

	// ── Storage ───────────────────────────────────────────────────────────────
	// Bind methods to preserve 'this' context
	uploadToTemporaryFolder: storageService.uploadToTemporaryFolder.bind(storageService),
	uploadToGCS: storageService.uploadToGCS.bind(storageService),
	generateSignedUrl: storageService.generateSignedUrl.bind(storageService),
	getFromGCS: storageService.getFromGCS.bind(storageService),
	getObjectMetadata: storageService.getObjectMetadata.bind(storageService),
	deleteFromGCS: storageService.deleteFromGCS.bind(storageService),
	fileExistsInGCS: storageService.fileExistsInGCS.bind(storageService),
	getStreamFromGCS: storageService.getStreamFromGCS.bind(storageService),

	// ── Media Processing ──────────────────────────────────────────────────────
	backendPixiService: mediaService.backendPixiService as any,
	getImageDimensions: mediaService.getImageDimensions.bind(mediaService),
	getImageBuffer: mediaService.getImageBuffer.bind(mediaService),
	resolveFileDataUrl: mediaService.resolveFileDataUrl.bind(mediaService),
	bufferToDataUrl: mediaService.bufferToDataUrl.bind(mediaService),

	env: ENV_CONFIG,
};
