import { GetAssetEndpoint } from "@gatewai/core/browser";
import type {
	VideoMetadata,
	VideoOperation,
	VirtualVideoData,
} from "@gatewai/core/types";

/**
 * Create a VirtualVideoData from a FileData source or Text.
 * Used by Import, VideoGen, and Text nodes to wrap concrete content.
 */
export function createVirtualVideo(
	source: any,
	type: "Video" | "Audio" | "Image" | "Text" = "Video",
): VirtualVideoData {
	if (type === "Text" && typeof source === "string") {
		source = {
			processData: {
				text: source,
				mimeType: "text/plain",
				width: 1920,
				height: 1080,
				fps: 24,
				duration: 5,
			},
		};
	}

	const sourceMeta = {
		width: source.entity?.width ?? source.processData?.width,
		height: source.entity?.height ?? source.processData?.height,
		durationMs: source.entity?.duration ?? source.processData?.duration,
		fps: source.processData?.fps,
	};

	const mimeType =
		source.entity?.mimeType ??
		source.processData?.mimeType ??
		(type === "Video"
			? "video/mp4"
			: type === "Audio"
				? "audio/mpeg"
				: type === "Image"
					? "image/png"
					: type === "Text"
						? "text/plain"
						: undefined);

	const text =
		type === "Text"
			? typeof source === "string"
				? source
				: (source.text ?? source.processData?.text)
			: undefined;

	return {
		metadata: sourceMeta,
		operation: {
			op: "source",
			source: {
				entity: source.entity,
				processData: {
					...(source.processData ?? {}),
					mimeType,
					text: text || (source.processData ?? {}).text,
				},
			},
			sourceMeta: sourceMeta,
		},
		children: [],
	};
}

/**
 * Identify if a VirtualVideoData node is intended to be Video, Audio, Image, or Text.
 */
export function getMediaType(
	vv: VirtualVideoData | any,
): "Video" | "Audio" | "Image" | "Text" {
	if (!vv) return "Video";

	const op = vv.operation;
	if (op?.op === "text") return "Text";

	if (op?.op === "source") {
		const mime = op.source?.processData?.mimeType || "";
		if (mime.startsWith("video/")) return "Video";
		if (mime.startsWith("audio/")) return "Audio";
		if (mime.startsWith("image/")) return "Image";
		if (mime.startsWith("text/")) return "Text";
	}

	// Recurse down children for non-compose operations
	if (op?.op !== "compose" && vv.children?.length > 0) {
		return getMediaType(vv.children[0]);
	}

	return "Video"; // Default
}

/**
 * Resolve the actual playable URL from a VirtualVideoData.
 * Walks down the tree to find the 'source' operation.
 * Supports legacy formats for backward compatibility.
 */
export function resolveVideoSourceUrl(
	vv: VirtualVideoData | any,
): string | undefined {
	if (!vv) return undefined;

	// New structure: leaf source node
	if (vv.operation?.op === "source") {
		const source = vv.operation.source;
		if (source?.entity) {
			return GetAssetEndpoint(source.entity) as string;
		}
		return source?.processData?.dataUrl;
	}

	// New structure: walk down children (assuming single path for non-compose)
	if (vv.children?.length > 0) {
		return resolveVideoSourceUrl(vv.children[0]);
	}

	// Legacy structure or direct FileData
	const source = vv.source ?? vv;
	if (source?.entity) {
		return GetAssetEndpoint(source.entity) as string;
	}
	return source?.processData?.dataUrl;
}

/**
 * Append an operation to an existing VirtualVideoData (recursive).
 * This creates a new parent node wrapping the current one as a child.
 */
export function appendOperation(
	vv: VirtualVideoData | any,
	operation: VideoOperation,
): VirtualVideoData {
	const nextMeta = computeNextMetadata(getActiveVideoMetadata(vv), operation);
	return {
		metadata: nextMeta,
		operation,
		children: [vv],
	};
}

/**
 * Helper to compute the metadata of the NEXT node in the operator tree.
 */
function computeNextMetadata(
	baseMeta: VideoMetadata,
	op: VideoOperation,
): VideoMetadata {
	let {
		width = 1920,
		height = 1080,
		durationMs = 0,
		fps = 24,
	} = baseMeta || {};

	// If an operation explicitly provides metadata, we use it as a base/override
	if ("metadata" in op && op.metadata) {
		width = op.metadata.width ?? width;
		height = op.metadata.height ?? height;
		durationMs = op.metadata.durationMs ?? durationMs;
	} else {
		// Otherwise, we infer changes from the operation itself
		switch (op.op) {
			case "crop": {
				width = Math.max(
					1,
					Math.round((op.widthPercentage / 100) * (width ?? 1920)),
				);
				height = Math.max(
					1,
					Math.round((op.heightPercentage / 100) * (height ?? 1080)),
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
				durationMs =
					((op.endSec ?? (durationMs ?? 0) / 1000) - op.startSec) * 1000;
				break;
			}
			case "layer": {
				width = op.width ?? width;
				height = op.height ?? height;
				if (op.durationInFrames && fps) {
					durationMs = (op.durationInFrames / fps) * 1000;
				}
				break;
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

/**
 * Get the active metadata from the VirtualVideoData node.
 * Simply returns the metadata property of the node.
 * Supports legacy formats (sourceMeta).
 */
export function getActiveVideoMetadata(
	vv: VirtualVideoData | any,
): VideoMetadata {
	if (!vv) return { width: 1920, height: 1080, fps: 24, durationMs: 0 };
	return vv.metadata ?? { width: 1920, height: 1080, fps: 24, durationMs: 0 };
}
