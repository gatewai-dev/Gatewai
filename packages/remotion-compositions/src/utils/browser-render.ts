import type { VirtualMediaData } from "@gatewai/core/types";
import {
	type RenderMediaOnWebProgress,
	renderMediaOnWeb,
} from "@remotion/web-renderer";
import { SingleClipComposition } from "../compositions/scene.js";
import { computeRenderParams } from "./apply-operations.js";

export type RenderOptions = {
	onProgress?: (progress: RenderMediaOnWebProgress) => void;
	signal?: AbortSignal;
};

/**
 * Renders a VirtualMediaData object into a real video Blob using Remotion in the browser.
 */
export async function renderVirtualMedia(
	virtualMedia: VirtualMediaData,
	options: RenderOptions = {},
): Promise<Blob> {
	const params = computeRenderParams(virtualMedia);

	// Default values if not present in metadata
	const width = virtualMedia.metadata.width ?? 1280;
	const height = virtualMedia.metadata.height ?? 720;
	const fps = virtualMedia.metadata.fps ?? 30;

	// Calculate total duration in frames
	const durationInFrames = Math.max(
		1,
		Math.ceil(params.effectiveDurationSec * fps),
	);

	const { getBlob } = await renderMediaOnWeb({
		composition: {
			id: "materialization",
			component: SingleClipComposition,
			durationInFrames,
			fps,
			width,
			height,
			defaultProps: {
				virtualMedia,
				containerWidth: width,
				containerHeight: height,
			},
		},
		inputProps: {
			virtualMedia,
			containerWidth: width,
			containerHeight: height,
		},
		onProgress: options.onProgress,
		signal: options.signal,
	});

	return await getBlob();
}
