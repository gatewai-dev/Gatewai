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
	let width = vv.sourceMeta.width ?? 1920;
	let height = vv.sourceMeta.height ?? 1080;
	let durationMs = vv.sourceMeta.durationMs ?? 0;
	const fps = vv.sourceMeta.fps;

	for (const op of vv.operations) {
		// If an operation explicitly provides metadata, we use it as a base/override
		if (op.metadata) {
			width = op.metadata.width ?? width;
			height = op.metadata.height ?? height;
			durationMs = op.metadata.durationMs ?? durationMs;
		} else {
			// Otherwise, we infer changes from the operation itself
			switch (op.op) {
				case "crop": {
					width = Math.max(
						1,
						Math.round((op.widthPercentage / 100) * width),
					);
					height = Math.max(
						1,
						Math.round((op.heightPercentage / 100) * height),
					);
					break;
				}
				case "rotate": {
					if (op.degrees % 180 !== 0) {
						[width, height] = [height, width];
					}
					break;
				}
				case "compose": {
					width = op.width;
					height = op.height;
					durationMs = (op.durationInFrames / op.fps) * 1000;
					break;
				}
				case "cut": {
					const speed = 1.0; // Simplified, speed ops are separate
					durationMs = ((op.endSec ?? durationMs / 1000) - op.startSec) * 1000;
					break;
				}
				// Speed changes don't change pixel dimensions, so we ignore them here
			}
		}
	}

	return {
		width,
		height,
		durationMs,
		fps,
	};
}
