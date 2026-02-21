import type { ExtendedLayer } from "@gatewai/core/types";
import { Video } from "@remotion/media";
import type React from "react";
import {
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

const DEFAULT_DURATION_FRAMES = 24 * 5; // 5 sec at 24 fps

// ---------------------------------------------------------------------------
// Animation math
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
// LayerRenderer
// ---------------------------------------------------------------------------

export const LayerRenderer: React.FC<{
	layer: ExtendedLayer;
	viewport: { w: number; h: number };
}> = ({ layer, viewport }) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

	const startFrame = layer.startFrame ?? 0;
	const duration = layer.durationInFrames ?? DEFAULT_DURATION_FRAMES;

	let src = layer.src;
	let trimStartSec = 0;
	let playbackRate = layer.speed ?? 1;
	let vvFilterString = "";
	let crop: { x: number; y: number; width: number; height: number } | null =
		null;
	let vvFlipH = false,
		vvFlipV = false,
		vvRotation = 0;
	let sw = 1920,
		sh = 1080;

	if (layer.virtualVideo) {
		const params = computeRenderParams(layer.virtualVideo);
		src = params.sourceUrl;
		trimStartSec = params.trimStartSec;
		playbackRate = (layer.speed ?? 1) * params.speed;
		vvFilterString = params.cssFilterString;
		crop = params.cropRegion;
		vvFlipH = params.flipH;
		vvFlipV = params.flipV;
		vvRotation = params.rotation;
		sw = layer.virtualVideo.sourceMeta?.width ?? 1920;
		sh = layer.virtualVideo.sourceMeta?.height ?? 1080;
	}

	const filterString = (() => {
		const cf = layer.filters?.cssFilters;
		if (!cf && !vvFilterString) return undefined;
		const defaults = {
			brightness: 100,
			contrast: 100,
			saturation: 100,
			hueRotate: 0,
			blur: 0,
			grayscale: 0,
			sepia: 0,
			invert: 0,
		};
		const layerCss = cf ? buildCSSFilterString({ ...defaults, ...cf }) : "";
		return [vvFilterString, layerCss].filter(Boolean).join(" ");
	})();

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
		filter: filterString || undefined,
	};

	const textContent = layer.text;

	const transforms: string[] = [];
	if (vvFlipH) transforms.push("scaleX(-1)");
	if (vvFlipV) transforms.push("scaleY(-1)");
	if (vvRotation) transforms.push(`rotate(${vvRotation}deg)`);

	const videoInnerStyle: React.CSSProperties = {
		width: "100%",
		height: "100%",
		objectFit: crop ? "fill" : "cover",
		transform: transforms.length ? transforms.join(" ") : undefined,
	};
	const startFromFrame = Math.floor(
		((layer.trimStart ?? 0) + trimStartSec) * fps,
	);

	return (
		<Sequence from={startFrame} durationInFrames={duration} layout="none">
			{layer.type === "Video" &&
				src &&
				(crop ? (
					<div style={{ ...style, overflow: "hidden" }}>
						<Video
							src={src}
							volume={animVolume}
							// @ts-expect-error
							startFrom={startFromFrame}
							playbackRate={playbackRate}
							style={{
								...videoInnerStyle,
								position: "absolute",
								left: `${(-crop.x / crop.width) * 100}%`,
								top: `${(-crop.y / crop.height) * 100}%`,
								width: `${(sw / crop.width) * 100}%`,
								height: `${(sh / crop.height) * 100}%`,
							}}
						/>
					</div>
				) : (
					<Video
						src={src}
						volume={animVolume}
						// @ts-expect-error
						startFrom={startFromFrame}
						playbackRate={playbackRate}
						style={{ ...style, ...videoInnerStyle }}
					/>
				))}
			{layer.type === "Image" && src && (
				<Img src={src} style={{ ...style, objectFit: "cover" }} />
			)}
			{layer.type === "Audio" && src && (
				<Html5Audio src={src} volume={animVolume} />
			)}
			{layer.type === "Text" && (
				<div
					style={{
						...style,
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
					{textContent}
				</div>
			)}
		</Sequence>
	);
};
