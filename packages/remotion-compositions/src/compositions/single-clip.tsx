import type { ExtendedLayer, VirtualVideoData } from "@gatewai/core/types";
import { Video } from "@remotion/media";
import type React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { computeRenderParams } from "../utils/apply-operations.js";
import { CompositionScene } from "./scene.js";

/**
 * SingleClipComposition — renders one VirtualVideoData.
 *
 * If the VirtualVideoData contains a `compose` operation, it delegates
 * to CompositionScene (multi-layer compositor output).
 * Otherwise it renders a single video clip applying the full operation stack
 * (trim, speed, filters, crop, flip, rotate) via computeRenderParams.
 */
export const SingleClipComposition: React.FC<{
	virtualVideo: VirtualVideoData;
}> = ({ virtualVideo }) => {
	const { fps } = useVideoConfig();

	// Check for compose operation — compositor output
	const composeOp = virtualVideo.operations.find((op) => op.op === "compose");
	if (composeOp && composeOp.op === "compose") {
		return (
			<CompositionScene
				layers={composeOp.layers as ExtendedLayer[]}
				viewportWidth={composeOp.width}
				viewportHeight={composeOp.height}
			/>
		);
	}

	// Single-clip: collapse operation stack to render params
	const params = computeRenderParams(virtualVideo);

	if (!params.sourceUrl) {
		return <AbsoluteFill style={{ backgroundColor: "#000" }} />;
	}

	const startFrame = Math.floor(params.trimStartSec * fps);
	const transforms: string[] = [];
	if (params.flipH) transforms.push("scaleX(-1)");
	if (params.flipV) transforms.push("scaleY(-1)");
	if (params.rotation) transforms.push(`rotate(${params.rotation}deg)`);

	return (
		<AbsoluteFill>
			<AbsoluteFill
				style={{
					filter: params.cssFilterString || undefined,
					transform: transforms.length ? transforms.join(" ") : undefined,
				}}
			>
				<Video
					src={params.sourceUrl}
					// @ts-expect-error
					startFrom={startFrame}
					playbackRate={params.speed}
					style={{ width: "100%", height: "100%", objectFit: "contain" }}
				/>
			</AbsoluteFill>
		</AbsoluteFill>
	);
};
