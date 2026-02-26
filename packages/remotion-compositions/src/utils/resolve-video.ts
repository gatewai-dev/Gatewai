import { GetAssetEndpoint } from "@gatewai/core/browser";
import type {
	VideoMetadata,
	VideoOperation,
	VirtualMediaData,
} from "@gatewai/core/types";

/**
 * Create a VirtualMediaData from a FileData source or Text.
 * Used by Import, VideoGen, and Text nodes to wrap concrete content.
 */
export function createVirtualMedia(
	source: any,
	type:
		| "Audio"
		| "Image"
		| "Video"
		| "Lottie"
		| "Json"
		| "ThreeD"
		| "SVG"
		| "Caption" = "Video",
): VirtualMediaData {
	// If it's already a VirtualMediaData, return it
	if (source && typeof source === "object" && "operation" in source) {
		return source as VirtualMediaData;
	}

	const sourceMeta = {
		width: source.entity?.width ?? source.processData?.width,
		height: source.entity?.height ?? source.processData?.height,
		durationMs: source.entity?.duration ?? source.processData?.duration,
		fps: source.entity?.fps ?? source.processData?.fps,
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
					: type === "SVG"
						? "image/svg+xml"
						: type === "Lottie" || type === "Json"
							? "application/json"
							: type === "ThreeD"
								? "model/gltf-binary"
								: type === "Caption"
									? "text/srt"
									: type === "Text"
										? "text/plain"
										: undefined);

	return {
		metadata: sourceMeta,
		operation: {
			op: "source",
			source: {
				entity: source.entity,
				processData: {
					...(source.processData ?? {}),
					mimeType,
					text: (source.processData ?? {}).text,
				},
			},
			sourceMeta: sourceMeta,
		},
		children: [],
	};
}

/**
 * Identify if a VirtualMediaData node is intended to be Video, Audio, Image, Lottie, or Text.
 */
export function getMediaType(
	vv: VirtualMediaData,
):
	| "Video"
	| "Audio"
	| "Image"
	| "Lottie"
	| "Text"
	| "SVG"
	| "ThreeD"
	| "Caption" {
	if (!vv) return "Video";

	const op = vv.operation;
	if (op?.op === "text") return "Text";

	if (op?.op === "source") {
		const mime = op.source?.processData?.mimeType || "";
		if (mime === "image/svg+xml") return "SVG";
		if (mime.startsWith("image/")) return "Image";
		if (mime.startsWith("video/")) return "Video";
		if (mime.startsWith("audio/")) return "Audio";
		if (mime === "application/json") return "Lottie";
		if (mime === "text/srt") return "Caption";
		if (mime.startsWith("text/")) return "Text";
		if (mime.startsWith("model/")) return "ThreeD";
	}

	// Recurse down children for non-compose operations
	if (op?.op !== "compose" && vv.children?.length > 0) {
		return getMediaType(vv.children[0]);
	}

	return "Video"; // Default
}

/**
 * Resolve the actual playable URL from a VirtualMediaData.
 * Walks down the tree to find the 'source' operation.
 * Supports legacy formats for backward compatibility.
 */
export function resolveVideoSourceUrl(
	vv: VirtualMediaData,
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

	return undefined;
}

/**
 * Append an operation to an existing VirtualMediaData (recursive).
 * This creates a new parent node wrapping the current one as a child.
 */
export function appendOperation(
	vv: VirtualMediaData,
	operation: VideoOperation,
): VirtualMediaData {
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
	baseMeta: VideoMetadata | null,
	op: VideoOperation,
): VideoMetadata {
	let {
		width = 1920,
		height = 1080,
		durationMs = undefined,
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
 * Get the active metadata from the VirtualMediaData node.
 * Simply returns the metadata property of the node.
 * Supports legacy formats (sourceMeta) and extracts from source if needed.
 */
export function getActiveVideoMetadata(
	vv: VirtualMediaData,
): VideoMetadata | null {
	if (!vv) return null;

	let width = vv.metadata?.width;
	let height = vv.metadata?.height;
	let durationMs = vv.metadata?.durationMs;
	let fps = vv.metadata?.fps;

	// Fill missing fields from children for non-compose/non-layer operators
	if (
		(width === undefined || height === undefined || durationMs === undefined) &&
		vv.children?.length > 0 &&
		vv.operation?.op !== "compose" &&
		vv.operation?.op !== "layer"
	) {
		const childMeta = getActiveVideoMetadata(vv.children[0]);
		if (childMeta) {
			width = width ?? childMeta.width;
			height = height ?? childMeta.height;
			durationMs = durationMs ?? childMeta.durationMs;
			fps = fps ?? childMeta.fps;
		}
	}

	// Check operation for source or text leaf nodes
	const op = vv.operation;
	if (op?.op === "source") {
		const sm = op.sourceMeta || {};
		width =
			width ??
			sm.width ??
			op.source?.processData?.width ??
			op.source?.entity?.width;
		height =
			height ??
			sm.height ??
			op.source?.processData?.height ??
			op.source?.entity?.height;
		durationMs =
			durationMs ??
			sm.durationMs ??
			op.source?.processData?.duration ??
			op.source?.entity?.duration;
		fps = fps ?? sm.fps ?? op.source?.processData?.fps;
	}

	if (width === undefined && height === undefined && durationMs === undefined) {
		return null;
	}

	return {
		width,
		height,
		durationMs: durationMs === 0 ? undefined : durationMs, // Avoid 0 duration falling back incorrectly
		fps,
	};
}
/**
 * Compute the dimensions and offsets for rendering a cropped video.
 * Traverses the VirtualMediaData tree to find nested crops and source dimensions.
 */
export function computeVideoCropRenderProps(virtualMedia: VirtualMediaData): {
	videoNaturalWidth: number;
	videoNaturalHeight: number;
	cropTranslatePercentageX: number; // Changed from Px to Percentage
	cropTranslatePercentageY: number; // Changed from Px to Percentage
} | null {
	let totalOffsetX = 0;
	let totalOffsetY = 0;
	let hasCrop = false;
	let sourceMetaFound = null;

	// Traverse the recursive tree to find crops and the source dimensions
	let currentNode: VirtualMediaData | undefined = virtualMedia;
	while (currentNode) {
		const op = currentNode.operation;

		if (op.op === "crop") {
			hasCrop = true;
			const inputMeta = currentNode.children[0]?.metadata;
			const inputW = inputMeta?.width ?? 0;
			const inputH = inputMeta?.height ?? 0;

			if (inputW > 0 && inputH > 0) {
				const cropLeftPx = (op.leftPercentage / 100) * inputW;
				const cropTopPx = (op.topPercentage / 100) * inputH;

				totalOffsetX += cropLeftPx;
				totalOffsetY += cropTopPx;
			}
		}

		if (op.op === "source") {
			sourceMetaFound = op.sourceMeta ?? currentNode.metadata;
		}

		// Move down the tree
		currentNode = currentNode.children[0];
	}

	if (!hasCrop || !sourceMetaFound) return null;

	const sourceW = sourceMetaFound.width ?? 1;
	const sourceH = sourceMetaFound.height ?? 1;

	// Convert absolute pixels back to a percentage relative to the source!
	const translatePctX = -(totalOffsetX / sourceW) * 100;
	const translatePctY = -(totalOffsetY / sourceH) * 100;

	return {
		videoNaturalWidth: sourceW,
		videoNaturalHeight: sourceH,
		cropTranslatePercentageX: translatePctX,
		cropTranslatePercentageY: translatePctY,
	};
}
