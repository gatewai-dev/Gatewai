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
import {
	getActiveVideoMetadata,
	resolveVideoSourceUrl,
} from "../utils/resolve-video.js";

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
//
// IMPORTANT: This component is always rendered inside a container div that is
// already sized to layer.width × layer.height by LayerRenderer. All layout
// math here must be relative to that container (use %, not px from viewport).
// ---------------------------------------------------------------------------
export const SingleClipComposition: React.FC<{
	virtualVideo: VirtualVideoData;
	volume?: number;
	playbackRateOverride?: number;
	trimStartOverride?: number;
}> = ({
	virtualVideo,
	volume = 1,
	playbackRateOverride,
	trimStartOverride,
}) => {
	const { fps } = useVideoConfig();

	// For recursive rendering, we need to decide what this specific node does.
	const op = virtualVideo?.operation;

	if (!op) {
		// Legacy fallback or leaf node – check if it has source
		const sourceUrl = (virtualVideo as any)?.source?.processData?.dataUrl;
		if (sourceUrl) {
			const meta = getActiveVideoMetadata(virtualVideo);
			return <Video src={sourceUrl} volume={volume} />;
		}
		return null;
	}

	// 1. If it's a 'compose', it acts as a container for many layers.
	if (op.op === "compose") {
		return (
			<CompositionScene
				layers={
					(virtualVideo.children || [])
						.map((child) => {
							// Each child of a compose must be a 'layer' operation to have position/timing
							if (child.operation?.op === "layer") {
								const lop = child.operation;
								return {
									id: Math.random().toString(), // Should ideally come from the op
									type:
										child.children[0]?.operation.op === "text"
											? "Text"
											: "Video", // Heuristic
									virtualVideo: child.children[0], // The content inside the layer
									x: lop.x,
									y: lop.y,
									width: lop.width,
									height: lop.height,
									rotation: lop.rotation,
									scale: lop.scale,
									opacity: lop.opacity,
									startFrame: lop.startFrame,
									durationInFrames: lop.durationInFrames ?? 1,
									zIndex: lop.zIndex,
								} as ExtendedLayer;
							}
							return null;
						})
						.filter(Boolean) as ExtendedLayer[]
				}
				viewportWidth={op.width}
				viewportHeight={op.height}
			/>
		);
	}

	// 2. If it's a 'source' or 'text', it's a leaf.
	if (op.op === "source" || op.op === "text") {
		const params = computeRenderParams(virtualVideo);
		if (op.op === "text") {
			return (
				<div
					style={{
						width: "100%",
						height: "100%",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
					}}
				>
					{op.text}
				</div>
			);
		}

		if (!params.sourceUrl) return <AbsoluteFill />;

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
				style={{ width: "100%", height: "100%", objectFit: "fill" }}
			/>
		);
	}

	// 3. For any other operation (crop, rotate, layer, etc.), we apply transforms and recurse.
	const params = computeRenderParams(virtualVideo);
	const transforms: string[] = [];
	if (params.flipH) transforms.push("scaleX(-1)");
	if (params.flipV) transforms.push("scaleY(-1)");
	if (params.rotation) transforms.push(`rotate(${params.rotation}deg)`);
	const transformStr = transforms.length ? transforms.join(" ") : undefined;

	const content =
		virtualVideo.children.length > 0 ? (
			<SingleClipComposition
				virtualVideo={virtualVideo.children[0]}
				volume={volume}
				playbackRateOverride={playbackRateOverride}
				trimStartOverride={trimStartOverride}
			/>
		) : null;

	if (params.cropRegion) {
		// Find the child that provides the "base" dimensions for cropping.
		const child = virtualVideo.children[0];
		const preCropMeta = child ? child.metadata : virtualVideo.metadata;

		const baseWidth = preCropMeta.width || 1920;
		const baseHeight = preCropMeta.height || 1080;

		const { x: cx, y: cy, width: cw, height: ch } = params.cropRegion;

		return (
			<AbsoluteFill
				style={{
					overflow: "hidden",
					filter: params.cssFilterString || undefined,
				}}
			>
				<div
					style={{
						position: "absolute",
						left: `${(-cx / cw) * 100}%`,
						top: `${(-cy / ch) * 100}%`,
						width: `${(baseWidth / cw) * 100}%`,
						height: `${(baseHeight / ch) * 100}%`,
					}}
				>
					<div
						style={{
							width: "100%",
							height: "100%",
							transform: transformStr,
							transformOrigin: "center center",
						}}
					>
						{content}
					</div>
				</div>
			</AbsoluteFill>
		);
	}

	return (
		<AbsoluteFill>
			<AbsoluteFill
				style={{
					filter: params.cssFilterString || undefined,
					transform: transformStr,
				}}
			>
				{content}
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
		transformOrigin: "center center",
		opacity: animOpacity,
		backgroundColor: layer.backgroundColor,
		borderColor: layer.borderColor,
		borderWidth: layer.borderWidth,
		borderRadius: layer.borderRadius,
		borderStyle: layer.borderWidth ? "solid" : undefined,
		overflow: "hidden",
		boxSizing: "border-box",
	};

	const filterString = (() => {
		const cf = layer.filters?.cssFilters;
		if (!cf) return undefined;
		return buildCSSFilterString(cf);
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
	layers?: ExtendedLayer[];
	viewportWidth: number;
	viewportHeight: number;
	// Single source props for better DX
	src?: string;
	isAudio?: boolean;
	type?: "Video" | "Audio" | "Image" | "Text" | string;
	data?: unknown;
	virtualVideo?: VirtualVideoData;
	children?: React.ReactNode;
}

export const CompositionScene: React.FC<SceneProps> = ({
	layers = [],
	viewportWidth,
	viewportHeight,
	src,
	isAudio,
	type,
	data,
	virtualVideo,
	children,
}) => {
	const frame = useCurrentFrame();

	const resolvedLayers = useMemo(() => {
		if (layers.length > 0) return layers;

		// Create a synthetic layer if no layers provided but single source props exist
		if (src || virtualVideo || type === "Text") {
			const resolvedType = type || (isAudio ? "Audio" : "Video");
			return [
				{
					id: "single-source-layer",
					type: resolvedType as any,
					src,
					virtualVideo,
					text: typeof data === "string" ? data : JSON.stringify(data),
					width: viewportWidth,
					height: viewportHeight,
					x: 0,
					y: 0,
					zIndex: 0,
					opacity: 1,
					scale: 1,
					rotation: 0,
				} as ExtendedLayer,
			];
		}

		return [];
	}, [
		layers,
		src,
		virtualVideo,
		type,
		isAudio,
		data,
		viewportWidth,
		viewportHeight,
	]);

	const sortedLayers = useMemo(
		() => [...resolvedLayers].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0)),
		[resolvedLayers],
	);

	const resolvedViewportW = viewportWidth || 1920;
	const resolvedViewportH = viewportHeight || 1080;

	return (
		<AbsoluteFill
			style={{
				backgroundColor: "#000000",
				overflow: "hidden",
				pointerEvents: "none",
			}}
		>
			<svg
				viewBox={`0 0 ${resolvedViewportW} ${resolvedViewportH}`}
				style={{
					width: "100%",
					height: "100%",
					position: "absolute",
					inset: 0,
				}}
				preserveAspectRatio="xMidYMid meet"
			>
				<foreignObject
					x="0"
					y="0"
					width={resolvedViewportW}
					height={resolvedViewportH}
					style={{ pointerEvents: "auto" }}
				>
					<div
						style={{
							width: resolvedViewportW,
							height: resolvedViewportH,
							position: "relative",
						}}
					>
						{sortedLayers.map((layer) => {
							const startFrame = layer.startFrame ?? 0;
							const duration =
								layer.durationInFrames ?? DEFAULT_DURATION_FRAMES;
							const endFrame = startFrame + duration;

							// Skip layers that aren't active at this frame
							if (frame < startFrame || frame >= endFrame) return null;

							let derivedWidth = layer.width;
							let derivedHeight = layer.height;

							if (layer.virtualVideo && layer.autoDimensions) {
								const activeMeta = getActiveVideoMetadata(layer.virtualVideo);
								derivedWidth = activeMeta.width ?? derivedWidth;
								derivedHeight = activeMeta.height ?? derivedHeight;
							}

							return (
								<LayerRenderer
									key={layer.id}
									layer={{
										...layer,
										width: derivedWidth,
										height: derivedHeight,
									}}
									viewport={{ w: resolvedViewportW, h: resolvedViewportH }}
								/>
							);
						})}
						{children}
					</div>
				</foreignObject>
			</svg>
		</AbsoluteFill>
	);
};
