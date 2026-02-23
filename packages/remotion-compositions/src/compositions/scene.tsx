import type { ExtendedLayer, VirtualVideoData } from "@gatewai/core/types";
import { Video } from "@remotion/media";
import type React from "react";
import { memo } from "react";
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
	getMediaType,
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
// SingleClipComposition
// ---------------------------------------------------------------------------

const compareVirtualVideo = (
	a: VirtualVideoData | undefined,
	b: VirtualVideoData | undefined,
): boolean => {
	if (a === b) return true;
	if (!a || !b) return false;

	const aOp = a.operation;
	const bOp = b.operation;

	if (aOp?.op !== bOp?.op) return false;

	switch (aOp.op) {
		case "source": {
			const bSource = bOp as any;
			const aDataUrl = aOp.source?.processData?.dataUrl;
			const bDataUrl = bSource.source?.processData?.dataUrl;
			if (aDataUrl !== bDataUrl) return false;
			break;
		}
		case "text": {
			const bText = bOp as any;
			if (aOp.text !== bText.text) return false;
			break;
		}
		case "crop": {
			const bCrop = bOp as any;
			if (
				aOp.leftPercentage !== bCrop.leftPercentage ||
				aOp.topPercentage !== bCrop.topPercentage ||
				aOp.widthPercentage !== bCrop.widthPercentage ||
				aOp.heightPercentage !== bCrop.heightPercentage
			)
				return false;
			break;
		}
		case "cut": {
			const bCut = bOp as any;
			if (aOp.startSec !== bCut.startSec || aOp.endSec !== bCut.endSec)
				return false;
			break;
		}
		case "speed": {
			const bSpeed = bOp as any;
			if (aOp.rate !== bSpeed.rate) return false;
			break;
		}
		case "rotate": {
			const bRotate = bOp as any;
			if (aOp.degrees !== bRotate.degrees) return false;
			break;
		}
		case "flip": {
			const bFlip = bOp as any;
			if (
				aOp.horizontal !== bFlip.horizontal ||
				aOp.vertical !== bFlip.vertical
			)
				return false;
			break;
		}
		case "filter": {
			const bFilter = bOp as any;
			if (
				JSON.stringify(aOp.filters.cssFilters) !==
				JSON.stringify(bFilter.filters.cssFilters)
			)
				return false;
			break;
		}
		case "layer": {
			const bLayer = bOp as any;
			if (
				aOp.x !== bLayer.x ||
				aOp.y !== bLayer.y ||
				aOp.width !== bLayer.width ||
				aOp.height !== bLayer.height ||
				aOp.rotation !== bLayer.rotation ||
				aOp.scale !== bLayer.scale ||
				aOp.opacity !== bLayer.opacity ||
				aOp.startFrame !== bLayer.startFrame ||
				aOp.durationInFrames !== bLayer.durationInFrames ||
				aOp.zIndex !== bLayer.zIndex ||
				aOp.text !== bLayer.text ||
				aOp.fontSize !== bLayer.fontSize ||
				aOp.fontFamily !== bLayer.fontFamily ||
				aOp.fontStyle !== bLayer.fontStyle ||
				aOp.fontWeight !== bLayer.fontWeight ||
				aOp.textDecoration !== bLayer.textDecoration ||
				aOp.fill !== bLayer.fill ||
				aOp.align !== bLayer.align ||
				aOp.verticalAlign !== bLayer.verticalAlign ||
				aOp.letterSpacing !== bLayer.letterSpacing ||
				aOp.lineHeight !== bLayer.lineHeight ||
				aOp.padding !== bLayer.padding ||
				aOp.stroke !== bLayer.stroke ||
				aOp.strokeWidth !== bLayer.strokeWidth ||
				aOp.backgroundColor !== bLayer.backgroundColor ||
				aOp.borderColor !== bLayer.borderColor ||
				aOp.borderWidth !== bLayer.borderWidth ||
				aOp.borderRadius !== bLayer.borderRadius ||
				aOp.autoDimensions !== bLayer.autoDimensions
			)
				return false;
			break;
		}
		case "compose": {
			const bCompose = bOp as any;
			if (
				aOp.width !== bCompose.width ||
				aOp.height !== bCompose.height ||
				aOp.fps !== bCompose.fps ||
				aOp.durationInFrames !== bCompose.durationInFrames
			)
				return false;

			if (a.children.length !== b.children.length) return false;
			for (let i = 0; i < a.children.length; i++) {
				if (!compareVirtualVideo(a.children[i], b.children[i])) return false;
			}
			return true;
		}
	}

	if (
		a.metadata.width !== b.metadata.width ||
		a.metadata.height !== b.metadata.height ||
		a.metadata.fps !== b.metadata.fps ||
		a.metadata.durationMs !== b.metadata.durationMs
	) {
		return false;
	}

	if (a.children.length !== b.children.length) return false;
	if (a.children.length > 0) {
		return compareVirtualVideo(a.children[0], b.children[0]);
	}

	return true;
};

const compareLayerProps = (
	prev: { layer: ExtendedLayer },
	next: { layer: ExtendedLayer },
): boolean => {
	const prevLayer = prev.layer;
	const nextLayer = next.layer;
	return (
		prevLayer.id === nextLayer.id &&
		prevLayer.type === nextLayer.type &&
		prevLayer.x === nextLayer.x &&
		prevLayer.y === nextLayer.y &&
		prevLayer.width === nextLayer.width &&
		prevLayer.height === nextLayer.height &&
		prevLayer.startFrame === nextLayer.startFrame &&
		prevLayer.durationInFrames === nextLayer.durationInFrames &&
		prevLayer.autoDimensions === nextLayer.autoDimensions &&
		prevLayer.text === nextLayer.text &&
		prevLayer.fontSize === nextLayer.fontSize &&
		prevLayer.fontFamily === nextLayer.fontFamily &&
		prevLayer.fontStyle === nextLayer.fontStyle &&
		prevLayer.fontWeight === nextLayer.fontWeight &&
		prevLayer.textDecoration === nextLayer.textDecoration &&
		prevLayer.fill === nextLayer.fill &&
		prevLayer.align === nextLayer.align &&
		prevLayer.verticalAlign === nextLayer.verticalAlign &&
		prevLayer.letterSpacing === nextLayer.letterSpacing &&
		prevLayer.lineHeight === nextLayer.lineHeight &&
		prevLayer.padding === nextLayer.padding &&
		prevLayer.stroke === nextLayer.stroke &&
		prevLayer.strokeWidth === nextLayer.strokeWidth &&
		prevLayer.backgroundColor === nextLayer.backgroundColor &&
		prevLayer.borderColor === nextLayer.borderColor &&
		prevLayer.borderWidth === nextLayer.borderWidth &&
		prevLayer.borderRadius === nextLayer.borderRadius &&
		compareVirtualVideo(prevLayer.virtualVideo, nextLayer.virtualVideo)
	);
};

export const SingleClipComposition: React.FC<{
	virtualVideo: VirtualVideoData;
	volume?: number;
	playbackRateOverride?: number;
	trimStartOverride?: number;
	textStyle?: Partial<ExtendedLayer>;
}> = memo(
	({
		virtualVideo,
		volume = 1,
		playbackRateOverride,
		trimStartOverride,
		textStyle,
	}) => {
		const { fps } = useVideoConfig();
		const op = virtualVideo?.operation;

		if (!op) {
			const sourceUrl = resolveVideoSourceUrl(virtualVideo);
			if (sourceUrl) {
				const type = getMediaType(virtualVideo);
				if (type === "Audio") {
					return <Html5Audio src={sourceUrl} volume={volume} />;
				}
				if (type === "Image") {
					return (
						<Img
							src={sourceUrl}
							style={{ width: "100%", height: "100%", objectFit: "fill" }}
						/>
					);
				}
				return <Video src={sourceUrl} volume={volume} />;
			}
			return null;
		}

		if (op.op === "compose") {
			return (
				<CompositionScene
					layers={
						(virtualVideo.children || [])
							.map((child) => {
								if (child.operation?.op === "layer") {
									const lop = child.operation;
									const contentType = getMediaType(child.children[0]);
									return {
										id: Math.random().toString(),
										type: contentType,
										virtualVideo: child.children[0],
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
										text: lop.text,
										fontSize: lop.fontSize,
										fontFamily: lop.fontFamily,
										fontStyle: lop.fontStyle,
										fontWeight: lop.fontWeight,
										textDecoration: lop.textDecoration,
										fill: lop.fill,
										align: lop.align,
										verticalAlign: lop.verticalAlign,
										letterSpacing: lop.letterSpacing,
										lineHeight: lop.lineHeight,
										padding: lop.padding,
										stroke: lop.stroke,
										strokeWidth: lop.strokeWidth,
										backgroundColor: lop.backgroundColor,
										borderColor: lop.borderColor,
										borderWidth: lop.borderWidth,
										borderRadius: lop.borderRadius,
										autoDimensions: lop.autoDimensions,
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

		if (op.op === "source" || op.op === "text") {
			const params = computeRenderParams(virtualVideo);
			const mediaType = getMediaType(virtualVideo);

			if (mediaType === "Text") {
				const mergedStyle = { ...textStyle, ...(op as any) };
				const textContent =
					op.op === "text"
						? op.text
						: op.op === "source"
							? op.source?.processData?.text
							: (op as any).text;

				return (
					<div
						style={{
							width: "100%",
							height: "100%",
							display: "flex",
							flexDirection: "column",
							alignItems: "stretch", // Use stretch to let width: 100% and textAlign work together
							justifyContent:
								mergedStyle.verticalAlign === "middle"
									? "center"
									: mergedStyle.verticalAlign === "bottom"
										? "flex-end"
										: "flex-start",
							color: mergedStyle.fill,
							fontSize: mergedStyle.fontSize,
							fontFamily: mergedStyle.fontFamily,
							fontStyle: mergedStyle.fontStyle,
							fontWeight: mergedStyle.fontWeight,
							textDecoration: mergedStyle.textDecoration,
							textAlign: (mergedStyle.align as any) ?? "center",
							padding: mergedStyle.padding,
							lineHeight: mergedStyle.lineHeight ?? 1.2,
							letterSpacing: mergedStyle.letterSpacing
								? `${mergedStyle.letterSpacing}px`
								: undefined,
							WebkitTextStroke:
								mergedStyle.strokeWidth && mergedStyle.stroke
									? `${mergedStyle.strokeWidth}px ${mergedStyle.stroke}`
									: undefined,
							paintOrder: "stroke fill",
							whiteSpace: "pre",
						}}
					>
						{textContent}
					</div>
				);
			}

			if (!params.sourceUrl) return <AbsoluteFill />;

			const startFrame = Math.floor(
				((trimStartOverride ?? 0) + params.trimStartSec) * fps,
			);
			const finalPlaybackRate = (playbackRateOverride ?? 1) * params.speed;

			if (mediaType === "Audio") {
				return (
					<Html5Audio
						src={params.sourceUrl}
						startFrom={startFrame}
						playbackRate={finalPlaybackRate}
						volume={volume}
					/>
				);
			}

			if (mediaType === "Image") {
				return (
					<Img
						src={params.sourceUrl}
						style={{ width: "100%", height: "100%", objectFit: "fill" }}
					/>
				);
			}

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

		const params = computeRenderParams(virtualVideo);
		const transforms: string[] = [];
		if (params.flipH) transforms.push("scaleX(-1)");
		if (params.flipV) transforms.push("scaleY(-1)");
		if (params.rotation) transforms.push(`rotate(${params.rotation}deg)`);
		const transformStr = transforms.length ? transforms.join(" ") : undefined;

		const childVideo = virtualVideo.children[0];
		const content = childVideo ? (
			<SingleClipComposition
				virtualVideo={childVideo}
				volume={volume}
				playbackRateOverride={playbackRateOverride}
				trimStartOverride={trimStartOverride}
				textStyle={
					op.op === "layer" ? { ...textStyle, ...(op as any) } : textStyle
				}
			/>
		) : null;

		if (params.cropRegion) {
			const { leftPct, topPct, widthPct, heightPct } = params.cropRegion;

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
							width: `${(100 / widthPct) * 100}%`,
							height: `${(100 / heightPct) * 100}%`,
							left: `${(-leftPct / widthPct) * 100}%`,
							top: `${(-topPct / heightPct) * 100}%`,
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
	},
	(prevProps, nextProps) => {
		return (
			compareVirtualVideo(prevProps.virtualVideo, nextProps.virtualVideo) &&
			prevProps.volume === nextProps.volume &&
			prevProps.playbackRateOverride === nextProps.playbackRateOverride &&
			prevProps.trimStartOverride === nextProps.trimStartOverride &&
			JSON.stringify(prevProps.textStyle) ===
				JSON.stringify(nextProps.textStyle)
		);
	},
);

const LayerContentRenderer: React.FC<{
	layer: ExtendedLayer;
	animVolume: number;
}> = memo(
	({ layer, animVolume }) => {
		if (layer.type === "Video" && layer.virtualVideo) {
			return (
				<SingleClipComposition
					virtualVideo={layer.virtualVideo}
					volume={animVolume}
					playbackRateOverride={layer.speed}
					trimStartOverride={layer.trimStart}
					textStyle={layer}
				/>
			);
		}
		if (layer.type === "Image" && (layer.src || layer.virtualVideo)) {
			if (layer.virtualVideo) {
				return (
					<SingleClipComposition
						virtualVideo={layer.virtualVideo}
						volume={animVolume}
						trimStartOverride={layer.trimStart}
						textStyle={layer}
					/>
				);
			}
			return (
				<Img
					src={layer.src!}
					style={{ width: "100%", height: "100%", objectFit: "cover" }}
				/>
			);
		}
		if (layer.type === "Audio" && (layer.src || layer.virtualVideo)) {
			if (layer.virtualVideo) {
				return (
					<SingleClipComposition
						virtualVideo={layer.virtualVideo}
						volume={animVolume}
						playbackRateOverride={layer.speed}
						trimStartOverride={layer.trimStart}
						textStyle={layer}
					/>
				);
			}
			return <Html5Audio src={layer.src!} volume={animVolume} />;
		}
		if (layer.type === "Text" && (layer.text || layer.virtualVideo)) {
			if (layer.virtualVideo) {
				return (
					<SingleClipComposition
						virtualVideo={layer.virtualVideo}
						volume={animVolume}
						trimStartOverride={layer.trimStart}
						textStyle={layer}
					/>
				);
			}
			return (
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
			);
		}
		return null;
	},
	(prevProps, nextProps) => {
		return (
			compareLayerProps(prevProps, nextProps) &&
			prevProps.animVolume === nextProps.animVolume
		);
	},
);

export const LayerRenderer: React.FC<{
	layer: ExtendedLayer;
	viewport: { w: number; h: number };
}> = memo(({ layer, viewport }) => {
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
				<AbsoluteFill>
					<LayerContentRenderer layer={layer} animVolume={animVolume} />
				</AbsoluteFill>
			</div>
		</Sequence>
	);
});

// ---------------------------------------------------------------------------
// CompositionScene — renders an ordered list of ExtendedLayer objects.
// ---------------------------------------------------------------------------

export interface SceneProps {
	layers?: ExtendedLayer[];
	viewportWidth: number;
	viewportHeight: number;
	src?: string;
	isAudio?: boolean;
	type?: "Video" | "Audio" | "Image" | "Text" | string;
	data?: unknown;
	virtualVideo?: VirtualVideoData;
	children?: React.ReactNode;
	text?: string;
	fontSize?: number;
	fontFamily?: string;
	fontStyle?: string;
	fontWeight?: number | string;
	WebkitTextStroke?: string;
	paintOrder?: string;
	autoDimensions?: boolean;
	textDecoration?: string;
	fill?: string;
	align?: string;
	verticalAlign?: string;
	letterSpacing?: number;
	lineHeight?: number;
	padding?: number;
	stroke?: string;
	strokeWidth?: number;
	backgroundColor?: string;
	borderColor?: string;
	borderWidth?: number;
	borderRadius?: number;
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
	text,
	fontSize,
	fontFamily,
	fontStyle,
	fontWeight,
	textDecoration,
	fill,
	align,
	verticalAlign,
	letterSpacing,
	lineHeight,
	padding,
	stroke,
	strokeWidth,
	backgroundColor,
	borderColor,
	borderWidth,
	borderRadius,
	autoDimensions,
}) => {
	const frame = useCurrentFrame();

	// Computed inline - fast logical derivations, prevents memo thrashing on remotion renders
	let resolvedLayers = layers;
	if (layers.length === 0 && (src || virtualVideo || type === "Text")) {
		const resolvedType = type || (isAudio ? "Audio" : "Video");
		resolvedLayers = [
			{
				id: "single-source-layer",
				type: resolvedType as any,
				src,
				virtualVideo,
				text:
					text ||
					(typeof data === "string"
						? data
						: (data as any)?.text || JSON.stringify(data)),
				width: viewportWidth,
				height: viewportHeight,
				x: 0,
				y: 0,
				zIndex: 0,
				opacity: 1,
				scale: 1,
				rotation: 0,
				fontSize,
				fontFamily,
				fontStyle,
				fontWeight,
				textDecoration,
				fill,
				align,
				verticalAlign,
				letterSpacing,
				lineHeight,
				padding,
				stroke,
				strokeWidth,
				backgroundColor,
				borderColor,
				borderWidth,
				borderRadius,
				autoDimensions,
			} as ExtendedLayer,
		];
	}

	// Sort is fast enough to run synchronously, no useMemo overhead required
	const sortedLayers = [...resolvedLayers].sort(
		(a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0),
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
			<div
				style={{
					width: resolvedViewportW,
					height: resolvedViewportH,
					position: "relative",
				}}
			>
				{sortedLayers.map((layer) => {
					const startFrame = layer.startFrame ?? 0;
					const duration = layer.durationInFrames ?? DEFAULT_DURATION_FRAMES;
					const endFrame = startFrame + duration;

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
		</AbsoluteFill>
	);
};
