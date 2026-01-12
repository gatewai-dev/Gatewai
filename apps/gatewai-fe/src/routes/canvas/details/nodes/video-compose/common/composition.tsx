import type { VideoCompositorLayer } from "@gatewai/types";
import { Video } from "@remotion/media";
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

// --- Constants ---
export const FPS = 24;
export const DEFAULT_DURATION_SEC = 5;
export const DEFAULT_DURATION_FRAMES = FPS * DEFAULT_DURATION_SEC;

// --- Types ---
export type AnimationType =
	| "fade-in"
	| "fade-out"
	| "slide-in-left"
	| "slide-in-right"
	| "slide-in-top"
	| "slide-in-bottom"
	| "zoom-in"
	| "zoom-out"
	| "rotate-cw"
	| "rotate-ccw"
	| "bounce"
	| "shake";

export interface VideoAnimation {
	id: string;
	type: AnimationType;
	value: number; // duration in seconds
}

export interface ExtendedLayer
	extends Omit<VideoCompositorLayer, "width" | "height"> {
	width?: number;
	height?: number;
	animations?: VideoAnimation[];
	maxDurationInFrames?: number;
	isPlaceholder?: boolean;
	src?: string; // Resolved URL for rendering
	text?: string; // Resolved text for rendering
}

export interface SceneProps {
	layers: ExtendedLayer[];
	viewportWidth: number;
	viewportHeight: number;
}

/**
 * Lazily injects a font face definition.
 */
export const injectFontFace = (family: string, url: string) => {
	if (!family || !url) return;
	const fontId = `font-${family.replace(/\s+/g, "-").toLowerCase()}`;
	if (document.getElementById(fontId)) return;

	const style = document.createElement("style");
	style.id = fontId;
	style.innerHTML = `
      @font-face {
        font-family: "${family}";
        src: url("${url}");
        font-display: swap; 
      }
    `;
	document.head.appendChild(style);
};

export const calculateLayerTransform = (
	layer: ExtendedLayer,
	frame: number,
	fps: number,
	viewport: { w: number; h: number },
) => {
	const relativeFrame = frame - (layer.startFrame ?? 0);
	let x = layer.x;
	let y = layer.y;
	let scale = layer.scale;
	let rotation = layer.rotation;
	let opacity = layer.opacity;
	const volume = layer.volume ?? 1;

	// Use default if undefined
	const duration = layer.durationInFrames ?? DEFAULT_DURATION_FRAMES;

	const animations = layer.animations ?? [];
	if (animations.length === 0)
		return { x, y, scale, rotation, opacity, volume };

	animations.forEach((anim) => {
		const durFrames = anim.value * fps;
		const isOut = anim.type.includes("-out");
		const startAnimFrame = isOut ? duration - durFrames : 0;
		const endAnimFrame = isOut ? duration : durFrames;

		if (relativeFrame < startAnimFrame || relativeFrame > endAnimFrame) {
			return;
		}

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

export const CompositionScene: React.FC<SceneProps> = ({
	layers,
	viewportWidth,
	viewportHeight,
}) => {
	const frame = useCurrentFrame();
	const { fps } = useVideoConfig();

	// Sort by zIndex for rendering order
	const sortedLayers = useMemo(
		() => [...layers].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0)),
		[layers],
	);

	return (
		<AbsoluteFill style={{ backgroundColor: "#000000" }}>
			{/* Inject Animation Keyframes for CSS-based previews if needed, though we use Remotion math mostly */}
			{sortedLayers.map((layer) => {
				const startFrame = layer.startFrame ?? 0;
				const duration = layer.durationInFrames ?? DEFAULT_DURATION_FRAMES;
				const endFrame = startFrame + duration;

				// Optimization: Do not render if out of frame bounds
				if (frame < startFrame || frame >= endFrame) return null;

				// Source Resolution
				// In Editor: handled via callbacks. In Node: handled via pre-resolved 'src' prop in ExtendedLayer.
				const src = layer.src;
				const textContent = layer.text;

				const {
					x: animX,
					y: animY,
					scale: animScale,
					rotation: animRotation,
					opacity: animOpacity,
					volume: animVolume,
				} = calculateLayerTransform(layer, frame, fps, {
					w: viewportWidth,
					h: viewportHeight,
				});

				const style: React.CSSProperties = {
					position: "absolute",
					left: animX,
					top: animY,
					width: layer.width,
					height: layer.height,
					transform: `rotate(${animRotation}deg) scale(${animScale})`,
					opacity: animOpacity,
					textAlign: layer.align,
				};

				return (
					<Sequence
						key={layer.id}
						from={layer.startFrame}
						durationInFrames={duration}
						layout="none"
					>
						{layer.type === "Video" && src && (
							<Video src={src} style={{ ...style }} volume={animVolume} />
						)}
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
									lineHeight: layer.lineHeight ?? 1.2,
									whiteSpace: "pre",
								}}
							>
								{textContent}
							</div>
						)}
					</Sequence>
				);
			})}
		</AbsoluteFill>
	);
};
