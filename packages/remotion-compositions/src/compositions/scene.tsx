import type { ExtendedLayer, VirtualMediaData } from "@gatewai/core/types";
import { Audio, Video } from "@remotion/media";
import type React from "react";
import { memo, useMemo } from "react";
import {
	AbsoluteFill,
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

const compareVirtualMedia = (
	a: VirtualMediaData | undefined,
	b: VirtualMediaData | undefined,
): boolean => {
	if (a === b) return true;
	if (!a || !b) return false;

	const aOp = a.operation;
	const bOp = b.operation;

	if (aOp?.op !== bOp?.op) return false;

	switch (aOp.op) {
		case "source": {
			if (bOp.op !== "source") return false;
			if (aOp.source?.processData?.dataUrl !== bOp.source?.processData?.dataUrl)
				return false;
			break;
		}
		case "text": {
			if (bOp.op !== "text") return false;
			if (aOp.text !== bOp.text) return false;
			break;
		}
		case "crop": {
			if (bOp.op !== "crop") return false;
			const isDifferent =
				aOp.leftPercentage !== bOp.leftPercentage ||
				aOp.topPercentage !== bOp.topPercentage ||
				aOp.widthPercentage !== bOp.widthPercentage ||
				aOp.heightPercentage !== bOp.heightPercentage;

			if (isDifferent) {
				return false;
			}
			break;
		}
		case "cut": {
			if (bOp.op !== "cut") return false;
			if (aOp.startSec !== bOp.startSec || aOp.endSec !== bOp.endSec)
				return false;
			break;
		}
		case "filter": {
			if (bOp.op !== "filter") return false;
			if (
				JSON.stringify(aOp.filters.cssFilters) !==
				JSON.stringify(bOp.filters.cssFilters)
			)
				return false;
			break;
		}
		case "layer": {
			if (bOp.op !== "layer") return false;
			if (
				aOp.x !== bOp.x ||
				aOp.y !== bOp.y ||
				aOp.width !== bOp.width ||
				aOp.height !== bOp.height ||
				aOp.rotation !== bOp.rotation ||
				aOp.scale !== bOp.scale ||
				aOp.opacity !== bOp.opacity ||
				aOp.startFrame !== bOp.startFrame ||
				aOp.durationInFrames !== bOp.durationInFrames ||
				aOp.zIndex !== bOp.zIndex ||
				aOp.text !== bOp.text ||
				aOp.fontSize !== bOp.fontSize ||
				aOp.fontFamily !== bOp.fontFamily ||
				aOp.fontStyle !== bOp.fontStyle ||
				aOp.fontWeight !== bOp.fontWeight ||
				aOp.textDecoration !== bOp.textDecoration ||
				aOp.fill !== bOp.fill ||
				aOp.align !== bOp.align ||
				aOp.verticalAlign !== bOp.verticalAlign ||
				aOp.letterSpacing !== bOp.letterSpacing ||
				aOp.lineHeight !== bOp.lineHeight ||
				aOp.padding !== bOp.padding ||
				aOp.stroke !== bOp.stroke ||
				aOp.strokeWidth !== bOp.strokeWidth ||
				aOp.backgroundColor !== bOp.backgroundColor ||
				aOp.borderColor !== bOp.borderColor ||
				aOp.borderWidth !== bOp.borderWidth ||
				aOp.borderRadius !== bOp.borderRadius ||
				aOp.autoDimensions !== bOp.autoDimensions
			)
				return false;
			break;
		}
		case "compose": {
			if (bOp.op !== "compose") return false;
			if (
				aOp.width !== bOp.width ||
				aOp.height !== bOp.height ||
				aOp.fps !== bOp.fps ||
				aOp.durationInFrames !== bOp.durationInFrames
			)
				return false;

			if (a.children.length !== b.children.length) return false;
			for (let i = 0; i < a.children.length; i++) {
				if (!compareVirtualMedia(a.children[i], b.children[i])) return false;
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
		return compareVirtualMedia(a.children[0], b.children[0]);
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
		compareVirtualMedia(prevLayer.virtualMedia, nextLayer.virtualMedia)
	);
};

export const SingleClipComposition: React.FC<{
	virtualMedia: VirtualMediaData;
	volume?: number;
	playbackRateOverride?: number;
	trimStartOverride?: number;
	textStyle?: Partial<ExtendedLayer>;
}> = ({
	virtualMedia,
	volume = 1,
	playbackRateOverride,
	trimStartOverride,
	textStyle,
}) => {
		const { fps } = useVideoConfig();
		const op = virtualMedia?.operation;

		// -----------------------------------------------------------------------
		// compose: delegate to CompositionScene
		// -----------------------------------------------------------------------
		if (op.op === "compose") {
			const composeNode = (
				<CompositionScene
					layers={
						(virtualMedia.children || [])
							.map((child, index) => {
								if (child.operation?.op === "layer") {
									const lop = child.operation;
									const contentType = getMediaType(child.children[0]);
									return {
										id: `child-${index}`,
										type: contentType,
										virtualMedia: child.children[0],
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
										trimStart: lop.trimStart,
										trimEnd: lop.trimEnd,
										speed: lop.speed,
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

			// If this compositor node is wrapped inside a Cut node, we use a negative Sequence
			// "from" offset to shift the internal timeframe backward.
			const trimFrames = trimStartOverride
				? Math.floor(trimStartOverride * fps)
				: 0;

			if (trimFrames > 0) {
				return (
					<Sequence from={-trimFrames} layout="none">
						{composeNode}
					</Sequence>
				);
			}

			return composeNode;
		}
		console.log({ op })
		// -----------------------------------------------------------------------
		// source / text: leaf nodes — render media directly.
		// -----------------------------------------------------------------------
		if (op.op === "source" || op.op === "text") {
			const params = computeRenderParams(virtualMedia);
			const mediaType = getMediaType(virtualMedia);

			if (mediaType === "Text") {
				const mergedStyle = { ...textStyle, ...(op as any) };
				const textContent =
					op.op === "text"
						? op.text
						: op.op === "source"
							? op.source?.processData?.text
							: undefined;

				return (
					<div
						style={{
							width: "100%",
							height: "100%",
							display: "flex",
							flexDirection: "column",
							alignItems: "stretch",
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

			const baseRate = Number(playbackRateOverride) || 1;
			const paramsRate = Number(params.speed) || 1;
			const finalPlaybackRate = baseRate * paramsRate;

			// Correctly accumulate both external cut nodes (trimStartOverride) and internal asset trims
			const effectiveTrimSec =
				(trimStartOverride ?? 0) + (Number(params.trimStartSec) || 0);
			const startFrame = Math.floor(effectiveTrimSec * fps);
			console.log({ mediaType, params, startFrame });
			if (mediaType === "Audio") {
				return (
					<Audio
						src={params.sourceUrl}
						trimBefore={startFrame}
						playbackRate={finalPlaybackRate}
						volume={volume}
					/>
				);
			}

			if (mediaType === "Image") {
				return (
					<Img
						src={params.sourceUrl}
						style={{
							position: "absolute",
							top: 0,
							left: 0,
							width: "100%",
							height: "100%",
							objectFit: "fill",
						}}
					/>
				);
			}

			return (
				<Video
					src={params.sourceUrl}
					playbackRate={finalPlaybackRate}
					trimBefore={startFrame}
					volume={volume}
					style={{
						position: "absolute",
						top: 0,
						left: 0,
						width: "100%",
						height: "100%",
						objectFit: "fill",
						display: "block",
					}}
				/>
			);
		}

		// -----------------------------------------------------------------------
		// speed: accumulate playback rate, pass trim through unchanged.
		// -----------------------------------------------------------------------
		if (op.op === "speed") {
			const childVideo = virtualMedia.children[0];
			if (!childVideo) return null;
			return (
				<SingleClipComposition
					virtualMedia={childVideo}
					volume={volume}
					playbackRateOverride={
						(Number(playbackRateOverride) || 1) * (Number(op.rate) || 1)
					}
					trimStartOverride={trimStartOverride}
					textStyle={textStyle}
				/>
			);
		}

		// -----------------------------------------------------------------------
		// cut: accumulate the start offset into trimStartOverride so the leaf
		// Video node can seek to the correct source position via startFrom.
		// Duration is handled externally (composition config / Sequence props).
		// -----------------------------------------------------------------------
		if (op.op === "cut") {
			const childVideo = virtualMedia.children[0];
			if (!childVideo) return null;

			const accumulatedTrim = (trimStartOverride ?? 0) + (op.startSec ?? 0);
			console.log({ accumulatedTrim });
			return (
				<SingleClipComposition
					virtualMedia={childVideo}
					volume={volume}
					playbackRateOverride={playbackRateOverride}
					trimStartOverride={accumulatedTrim}
					textStyle={textStyle}
				/>
			);
		}

		// -----------------------------------------------------------------------
		// Transformers (crop, rotate, flip, filter, layer)
		// -----------------------------------------------------------------------
		const childVideo = virtualMedia.children[0];

		const content = childVideo ? (
			<SingleClipComposition
				virtualMedia={childVideo}
				volume={volume}
				playbackRateOverride={playbackRateOverride}
				trimStartOverride={trimStartOverride}
				textStyle={
					op.op === "layer" ? { ...textStyle, ...(op as any) } : textStyle
				}
			/>
		) : null;

		if (op.op === "crop") {
			const wp = Math.max(0.01, Number(op.widthPercentage) || 100);
			const hp = Math.max(0.01, Number(op.heightPercentage) || 100);
			const lp = Number(op.leftPercentage) || 0;
			const tp = Number(op.topPercentage) || 0;

			// Use reciprocal percentage bounds instead of CSS Transform
			// This sidesteps double-scaling conflicts when working with container queries
			const innerWidth = (100 / wp) * 100;
			const innerHeight = (100 / hp) * 100;
			const innerLeft = (lp / wp) * 100;
			const innerTop = (tp / hp) * 100;

			console.log("[SingleClipComposition] Applying Crop", {
				input: { wp, hp, lp, tp },
				calculated: { innerWidth, innerHeight, innerLeft, innerTop },
			});

			const innerStyle: React.CSSProperties = {
				position: "absolute",
				width: `${innerWidth}%`,
				height: `${innerHeight}%`,
				left: `-${innerLeft}%`,
				top: `-${innerTop}%`,
			};

			return (
				<AbsoluteFill style={{ overflow: "hidden" }}>
					<div
						style={innerStyle}
						key={`crop-${wp}-${hp}-${lp}-${tp}`} // Force remount on change
					>
						<AbsoluteFill>{content}</AbsoluteFill>
					</div>
				</AbsoluteFill>
			);
		}

		let transformStr: string | undefined;
		let cssFilterString: string | undefined;

		if (op.op === "rotate") {
			transformStr = `rotate(${(op as any).degrees}deg)`;
		} else if (op.op === "flip") {
			const transforms = [];
			if (op.horizontal) transforms.push("scaleX(-1)");
			if (op.vertical) transforms.push("scaleY(-1)");
			transformStr = transforms.length ? transforms.join(" ") : undefined;
		} else if (op.op === "filter") {
			cssFilterString = buildCSSFilterString((op as any).filters.cssFilters);
		}

		return (
			<AbsoluteFill
				style={{
					filter: cssFilterString,
					transform: transformStr,
				}}
			>
				{content}
			</AbsoluteFill>
		);
	};

const LayerContentRenderer: React.FC<{
	layer: ExtendedLayer;
	animVolume: number;
}> = memo(
	({ layer, animVolume }) => {
		if (layer.type === "Video" && layer.virtualMedia) {
			return (
				<SingleClipComposition
					virtualMedia={layer.virtualMedia}
					volume={animVolume}
					playbackRateOverride={layer.speed}
					trimStartOverride={layer.trimStart}
					textStyle={layer}
				/>
			);
		}
		if (layer.type === "Image" && (layer.src || layer.virtualMedia)) {
			if (layer.virtualMedia) {
				return (
					<SingleClipComposition
						virtualMedia={layer.virtualMedia}
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
		if (layer.type === "Audio" && (layer.src || layer.virtualMedia)) {
			if (layer.virtualMedia) {
				return (
					<SingleClipComposition
						virtualMedia={layer.virtualMedia}
						volume={animVolume}
						playbackRateOverride={layer.speed}
						trimStartOverride={layer.trimStart}
						textStyle={layer}
					/>
				);
			}
			return <Audio src={layer.src!} volume={animVolume} />;
		}
		if (layer.type === "Text" && (layer.text || layer.virtualMedia)) {
			if (layer.virtualMedia) {
				return (
					<SingleClipComposition
						virtualMedia={layer.virtualMedia}
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
	virtualMedia?: VirtualMediaData;
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
	virtualMedia,
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
	const { fps } = useVideoConfig();

	const resolvedLayers = useMemo(() => {
		if (layers.length > 0) return layers;

		if (src || virtualMedia || type === "Text") {
			const resolvedType = type || (isAudio ? "Audio" : "Video");

			let durationInFrames = undefined;
			if (virtualMedia) {
				const activeMeta = getActiveVideoMetadata(virtualMedia);
				if (activeMeta?.durationMs) {
					durationInFrames = Math.ceil((activeMeta.durationMs / 1000) * (fps || 24));
				}
			}

			return [
				{
					id: "single-source-layer",
					type: resolvedType as any,
					src,
					virtualMedia,
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
					durationInFrames,
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
		return [];
	}, [
		layers,
		src,
		virtualMedia,
		type,
		isAudio,
		text,
		data,
		viewportWidth,
		viewportHeight,
		fps,
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
	]);

	const layersToRender = useMemo(() => {
		return [...resolvedLayers]
			.sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))
			.map((layer) => {
				let derivedWidth = layer.width;
				let derivedHeight = layer.height;

				if (layer.virtualMedia && layer.autoDimensions) {
					const activeMeta = getActiveVideoMetadata(layer.virtualMedia);
					derivedWidth = activeMeta?.width ?? derivedWidth;
					derivedHeight = activeMeta?.height ?? derivedHeight;
				}

				return {
					...layer,
					width: derivedWidth,
					height: derivedHeight,
				};
			});
	}, [resolvedLayers]);

	const resolvedViewportW = viewportWidth || 1920;
	const resolvedViewportH = viewportHeight || 1080;

	const viewport = useMemo(
		() => ({ w: resolvedViewportW, h: resolvedViewportH }),
		[resolvedViewportW, resolvedViewportH],
	);

	return (
		<AbsoluteFill
			style={{
				backgroundColor: "#000000",
				overflow: "hidden",
				pointerEvents: "none",
				containerType: "size",
			}}
		>
			<div
				style={{
					width: resolvedViewportW,
					height: resolvedViewportH,
					position: "absolute",
					top: 0,
					left: 0,
					transform: `scale(calc(100cqw / (${resolvedViewportW} * 1px)), calc(100cqh / (${resolvedViewportH} * 1px)))`,
					transformOrigin: "top left",
				}}
			>
				{layersToRender.map((layer) => {
					const startFrame = layer.startFrame ?? 0;
					const duration = layer.durationInFrames ?? DEFAULT_DURATION_FRAMES;
					const endFrame = startFrame + duration;

					if (frame < startFrame || frame >= endFrame) return null;

					return (
						<LayerRenderer key={layer.id} layer={layer} viewport={viewport} />
					);
				})}
			</div>
		</AbsoluteFill>
	);
};
