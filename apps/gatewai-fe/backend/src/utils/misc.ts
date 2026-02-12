import { ENV_CONFIG } from "@gatewai/core";
import { MIME_TYPES, type FileData, type ProcessData } from "@gatewai/core/types";
import type { FileAsset } from "@gatewai/db";

export function assertIsError(error: unknown): asserts error is Error {
	if (!(error instanceof Error)) {
		throw error;
	}
}
