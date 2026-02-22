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

	if (params.cropRegion) {
		const sw = virtualVideo.sourceMeta?.width ?? 1920;
		const sh = virtualVideo.sourceMeta?.height ?? 1080;
		const cw = params.cropRegion.width;
		const ch = params.cropRegion.height;

		return (
			<AbsoluteFill
				style={{
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					backgroundColor: "#000",
				}}
			>
				<div
					style={{
						position: "relative",
						width: "100%",
						height: "100%",
						filter: params.cssFilterString || undefined,
					}}
				>
					<div
						style={{
							position: "absolute",
							left: "50%",
							top: "50%",
							transform: "translate(-50%, -50%)",
							width: "100%",
							height: "100%",
							maxWidth: "100%",
							maxHeight: "100%",
							aspectRatio: `${cw} / ${ch}`,
							overflow: "hidden",
						}}
					>
						<Video
							src={params.sourceUrl}
							playbackRate={params.speed}
							startFrom={startFrame}
							style={{
								position: "absolute",
								left: `${(-params.cropRegion.x / cw) * 100}%`,
								top: `${(-params.cropRegion.y / ch) * 100}%`,
								width: `${(sw / cw) * 100}%`,
								height: `${(sh / ch) * 100}%`,
								objectFit: "fill",
								transform: transforms.length ? transforms.join(" ") : undefined,
							}}
						/>
					</div>
				</div>
			</AbsoluteFill>
		);
	}

	return (
		<AbsoluteFill style={{ backgroundColor: "#000" }}>
			<AbsoluteFill
				style={{
					filter: params.cssFilterString || undefined,
					transform: transforms.length ? transforms.join(" ") : undefined,
				}}
			>
				<Video
					src={params.sourceUrl}
					playbackRate={params.speed}
					startFrom={startFrame}
					style={{ width: "100%", height: "100%", objectFit: "contain" }}
				/>
			</AbsoluteFill>
		</AbsoluteFill>
	);
};
