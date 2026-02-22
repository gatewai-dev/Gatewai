import type { VirtualVideoData } from "@gatewai/core/types";
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
 * Renders a VirtualVideoData object into a real video Blob using Remotion in the browser.
 */
export async function renderVirtualVideo(
	virtualVideo: VirtualVideoData,
	options: RenderOptions = {},
): Promise<Blob> {
	const params = computeRenderParams(virtualVideo);

	// Default values if not present in sourceMeta
	const width = virtualVideo.sourceMeta.width ?? 1280;
	const height = virtualVideo.sourceMeta.height ?? 720;
	const fps = virtualVideo.sourceMeta.fps ?? 30;

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
			defaultProps: { virtualVideo },
		},
		inputProps: { virtualVideo },
		onProgress: options.onProgress,
		signal: options.signal,
	});

	return await getBlob();
}
