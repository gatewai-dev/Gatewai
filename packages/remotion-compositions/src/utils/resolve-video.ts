import { GetAssetEndpoint } from "@gatewai/core/browser";
import type {
	VideoMetadata,
	VideoOperation,
	VirtualVideoData,
} from "@gatewai/core/types";

/**
 * Create a VirtualVideoData from a FileData source.
 * Used by Import and VideoGen nodes to wrap concrete file assets.
 */
export function createVirtualVideo(source: any): VirtualVideoData {
	return {
		source: {
			entity: source.entity,
			processData: source.processData,
		},
		sourceMeta: {
			width: source.entity?.width ?? source.processData?.width,
			height: source.entity?.height ?? source.processData?.height,
			durationMs: source.entity?.duration ?? source.processData?.duration,
			fps: source.processData?.fps,
		},
		operations: [],
	};
}

/**
 * Resolve the actual playable URL from a VirtualVideoData or FileData source.
 */
export function resolveVideoSourceUrl(
	vv: VirtualVideoData | any,
): string | undefined {
	const source = (vv as VirtualVideoData).source ?? vv;
	if (source.entity) {
		return GetAssetEndpoint(source.entity) as string;
	}
	return source.processData?.dataUrl;
}

/**
 * Append an operation to an existing VirtualVideoData (immutable).
 */
export function appendOperation(
	vv: VirtualVideoData,
	operation: VideoOperation,
): VirtualVideoData {
	return {
		...vv,
		operations: [...vv.operations, operation],
	};
}

/**
 * Get the active metadata from the latest operation that provides/modifies it.
 * Falls back to sourceMeta if no operations have metadata.
 */
export function getActiveVideoMetadata(vv: VirtualVideoData): VideoMetadata {
	// Start with source metadata
	const metadata: VideoMetadata = { ...vv.sourceMeta };

	// Iterate from newest to oldest to find the first operation with metadata
	for (let i = vv.operations.length - 1; i >= 0; i--) {
		const op = vv.operations[i];
		if (op.metadata) {
			return { ...op.metadata };
		}
	}

	return metadata;
}
