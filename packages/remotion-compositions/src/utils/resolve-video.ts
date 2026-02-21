import { GetAssetEndpoint } from "@gatewai/core/browser";
import type { VideoOperation, VirtualVideoData } from "@gatewai/core/types";

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
 * Uses the GCS signed URL stored on the entity, or falls back to
 * the in-memory processData.dataUrl for browser-generated videos.
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
