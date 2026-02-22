import type { ExtendedLayer, VirtualVideoData } from "@gatewai/core/types";
import { Video } from "@remotion/media";
import type React from "react";
import { useMemo } from "react";
import {
	AbsoluteFill,
	Html5Audio,
	Img,
	interpolate,
	Sequence,
	spring,
	useCurrentFrame,
	useVideoConfig,
} from "remotion";
import {
	buildCSSFilterString,
	computeRenderParams,
} from "../utils/apply-operations.js";
import { resolveVideoSourceUrl } from "../utils/resolve-video.js";

const DEFAULT_DURATION_FRAMES = 24 * 5; // 5 sec at 24 fps

// ---------------------------------------------------------------------------
// Animation math & Transformation
// ---------------------------------------------------------------------------

export const calculateLayerTransform = (
	layer: ExtendedLayer,
	frame: number,
	fps: number,
	viewport: { w: number; h: number },
) => {
	const relativeFrame = frame - (layer.startFrame ?? 0);
	let x = layer.x;
	let y = layer.y;
	let scale = layer.scale ?? 1;
	let rotation = layer.rotation;
	let opacity = layer.opacity ?? 1;
	const volume = layer.volume ?? 1;

	const duration = layer.durationInFrames ?? DEFAULT_DURATION_FRAMES;
	const animations = layer.animations ?? [];
	if (animations.length === 0)
		return { x, y, scale, rotation, opacity, volume };

	animations.forEach((anim) => {
		const durFrames = anim.value * fps;
		const isOut = anim.type.includes("-out");
		const startAnimFrame = isOut ? duration - durFrames : 0;
		const endAnimFrame = isOut ? duration : durFrames;

		if (relativeFrame < startAnimFrame || relativeFrame > endAnimFrame) return;

		const progress = interpolate(
			relativeFrame,
			[startAnimFrame, endAnimFrame],
			[0, 1],
			{ extrapolateLeft: "clamp", extrapolateRight: "clamp" },
		);

		switch (anim.type) {
			case "fade-in":
				opacity *= progress;
				break;
			case "fade-out":
				opacity *= 1 - progress;
				break;
			case "slide-in-left":
				x += -1 * viewport.w * (1 - progress);
				break;
			case "slide-in-right":
				x += 1 * viewport.w * (1 - progress);
				break;
			case "slide-in-top":
				y += -1 * viewport.h * (1 - progress);
				break;
			case "slide-in-bottom":
				y += 1 * viewport.h * (1 - progress);
				break;
			case "zoom-in":
				scale *= interpolate(progress, [0, 1], [0, 1]);
				break;
			case "zoom-out":
				scale *= interpolate(progress, [0, 1], [1, 0]);
				break;
			case "rotate-cw":
				rotation += 360 * progress;
				break;
			case "rotate-ccw":
				rotation += -360 * progress;
				break;
			case "bounce": {
				const bounceVal = spring({
					frame: relativeFrame - startAnimFrame,
					fps,
					config: { damping: 10, mass: 0.5, stiffness: 100 },
					durationInFrames: durFrames,
				});
				scale *= bounceVal;
				break;
			}
			case "shake": {
				const intensity = 20;
				x +=
					intensity *
					Math.sin((relativeFrame * 10 * 2 * Math.PI) / durFrames) *
					(1 - progress);
				break;
			}
		}
	});

	return { x, y, scale, rotation, opacity, volume };
};

// ---------------------------------------------------------------------------
// SingleClipComposition — renders one VirtualVideoData.
// ---------------------------------------------------------------------------
export const SingleClipComposition: React.FC<{
	virtualVideo: VirtualVideoData;
	volume?: number;
	playbackRateOverride?: number;
	trimStartOverride?: number;
}> = ({ virtualVideo, volume = 1, playbackRateOverride, trimStartOverride }) => {
	const { fps } = useVideoConfig();
	const params = computeRenderParams(virtualVideo);

	// Check for compose operation — compositor output
	const composeOp = virtualVideo.operations.find((op) => op.op === "compose");

	const renderContent = () => {
		if (composeOp) {
			return (
				<CompositionScene
					layers={composeOp.layers as ExtendedLayer[]}
					viewportWidth={composeOp.width}
					viewportHeight={composeOp.height}
				/>
			);
		}

		if (!params.sourceUrl) {
			return <AbsoluteFill style={{ backgroundColor: "#000" }} />;
		}

		const startFrame = Math.floor(
			((trimStartOverride ?? 0) + params.trimStartSec) * fps,
		);
		const finalPlaybackRate = (playbackRateOverride ?? 1) * params.speed;

		return (
			<Video
				src={params.sourceUrl}
				playbackRate={finalPlaybackRate}
				startFrom={startFrame}
				volume={volume}
				style={{ width: "100%", height: "100%", objectFit: "contain" }}
			/>
		);
	};

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
						<div
							style={{
								position: "absolute",
								left: `${(-params.cropRegion.x / cw) * 100}%`,
								top: `${(-params.cropRegion.y / ch) * 100}%`,
								width: `${(sw / cw) * 100}%`,
								height: `${(sh / ch) * 100}%`,
								transform: transforms.length ? transforms.join(" ") : undefined,
							}}
						>
							{renderContent()}
						</div>
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
				{renderContent()}
			</AbsoluteFill>
		</AbsoluteFill>
	);
};

// ---------------------------------------------------------------------------
// LayerRenderer — renders one ExtendedLayer.
// ---------------------------------------------------------------------------
export const LayerRenderer: React.FC<{
	layer: ExtendedLayer;
	viewport: { w: number; h: number };
}> = ({ layer, viewport }) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

	const startFrame = layer.startFrame ?? 0;
	const duration = layer.durationInFrames ?? DEFAULT_DURATION_FRAMES;

	const {
		x: animX,
		y: animY,
		scale: animScale,
		rotation: animRotation,
		opacity: animOpacity,
		volume: animVolume,
	} = calculateLayerTransform(layer, frame, fps, viewport);

	const style: React.CSSProperties = {
		position: "absolute",
		left: animX,
		top: animY,
		width: layer.width,
		height: layer.height,
		transform: `rotate(${animRotation}deg) scale(${animScale})`,
		opacity: animOpacity,
		backgroundColor: layer.backgroundColor,
		borderColor: layer.borderColor,
		borderWidth: layer.borderWidth,
		borderRadius: layer.borderRadius,
		borderStyle: layer.borderWidth ? "solid" : undefined,
	};

	const filterString = (() => {
		const cf = layer.filters?.cssFilters;
		if (!cf) return undefined;
		return buildCSSFilterString({
			brightness: 100,
			contrast: 100,
			saturation: 100,
			hueRotate: 0,
			blur: 0,
			grayscale: 0,
			sepia: 0,
			invert: 0,
			...cf,
		} as any);
	})();

	return (
		<Sequence from={startFrame} durationInFrames={duration} layout="none">
			<div style={{ ...style, filter: filterString }}>
				{layer.type === "Video" && layer.virtualVideo && (
					<SingleClipComposition
						virtualVideo={layer.virtualVideo}
						volume={animVolume}
						playbackRateOverride={layer.speed}
						trimStartOverride={layer.trimStart}
					/>
				)}
				{layer.type === "Image" && (layer.src || layer.virtualVideo) && (
					<Img
						src={
							layer.virtualVideo
								? (resolveVideoSourceUrl(layer.virtualVideo) as string)
								: layer.src!
						}
						style={{ width: "100%", height: "100%", objectFit: "cover" }}
					/>
				)}
				{layer.type === "Audio" && (layer.src || layer.virtualVideo) && (
					<Html5Audio
						src={
							layer.virtualVideo
								? (resolveVideoSourceUrl(layer.virtualVideo) as string)
								: layer.src!
						}
						volume={animVolume}
					/>
				)}
				{layer.type === "Text" && (
					<div
						style={{
							width: "100%",
							height: "100%",
							color: layer.fill,
							fontSize: layer.fontSize,
							fontFamily: layer.fontFamily,
							fontStyle: layer.fontStyle,
							fontWeight: layer.fontWeight,
							textDecoration: layer.textDecoration,
							lineHeight: layer.lineHeight ?? 1.2,
							letterSpacing: layer.letterSpacing
								? `${layer.letterSpacing}px`
								: undefined,
							textAlign: (layer.align as "left" | "center" | "right") ?? "left",
							padding: layer.padding,
							WebkitTextStroke:
								layer.strokeWidth && layer.stroke
									? `${layer.strokeWidth}px ${layer.stroke}`
									: undefined,
							paintOrder: "stroke fill",
							display: "flex",
							flexDirection: "column",
							justifyContent:
								layer.verticalAlign === "middle"
									? "center"
									: layer.verticalAlign === "bottom"
										? "flex-end"
										: "flex-start",
							whiteSpace: "pre",
						}}
					>
						{layer.text}
					</div>
				)}
			</div>
		</Sequence>
	);
};

// ---------------------------------------------------------------------------
// CompositionScene — renders an ordered list of ExtendedLayer objects.
// ---------------------------------------------------------------------------

export interface SceneProps {
	layers: ExtendedLayer[];
	viewportWidth: number;
	viewportHeight: number;
}

export const CompositionScene: React.FC<SceneProps> = ({
	layers,
	viewportWidth,
	viewportHeight,
}) => {
	const frame = useCurrentFrame();

	const sortedLayers = useMemo(
		() => [...layers].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0)),
		[layers],
	);

	return (
		<AbsoluteFill style={{ backgroundColor: "#000000" }}>
			{sortedLayers.map((layer) => {
				const startFrame = layer.startFrame ?? 0;
				const duration = layer.durationInFrames ?? DEFAULT_DURATION_FRAMES;
				const endFrame = startFrame + duration;

				// Skip layers that aren't active at this frame
				if (frame < startFrame || frame >= endFrame) return null;

				return (
					<LayerRenderer
						key={layer.id}
						layer={layer}
						viewport={{ w: viewportWidth, h: viewportHeight }}
					/>
				);
			})}
		</AbsoluteFill>
	);
};
