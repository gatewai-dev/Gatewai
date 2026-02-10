import { ENV_CONFIG } from "@gatewai/core";
import { ServerMediaService } from "@gatewai/media";
import { GCSStorageService } from "@gatewai/storage";
import type { FileData } from "@gatewai/types";
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
	googleApplicationCredentialsPath:
		ENV_CONFIG.GOOGLE_APPLICATION_CREDENTIALS_PATH,
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
	loadMediaBuffer: (fileData: FileData) =>
		loadMediaBuffer(storageService, fileData),
	getFileDataMimeType: (fileData: FileData) =>
		getFileDataMimeType(storageService, fileData),
};
