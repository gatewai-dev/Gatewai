import type { ExtendedLayer } from "@gatewai/core/types";
import {
	resolveVideoSourceUrl,
	SingleClipComposition,
} from "@gatewai/remotion-compositions";
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

// Optional local interface if `ExtendedLayer` does not carry autoDimensions
type EditorLayer = ExtendedLayer;

const DEFAULT_DURATION_FRAMES = 24 * 5; // Default 5 seconds at 24 fps

export const calculateLayerTransform = (
	layer: EditorLayer,
	frame: number,
	fps: number,
	viewport: { w: number; h: number },
) => {
	const relativeFrame = frame - (layer.startFrame ?? 0);
	let x = layer.x;
	let y = layer.y;
	let scale = layer.scale ?? 1;
	let rotation = layer.rotation;
	let opacity = layer.opacity;
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

export interface SceneProps {
	layers: EditorLayer[];
	viewportWidth: number;
	viewportHeight: number;
}

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

	const resolvedViewportW = viewportWidth || 1920;
	const resolvedViewportH = viewportHeight || 1080;
	console.log({ layers });
	return (
		<AbsoluteFill style={{ overflow: "hidden", pointerEvents: "none" }}>
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

							// Optimization: Do not render if out of frame bounds
							if (frame < startFrame || frame >= endFrame) return null;

							// Resolve URL: prefer virtualVideo if present, else use layer.src
							const src = layer.virtualVideo
								? resolveVideoSourceUrl(layer.virtualVideo)
								: layer.src;
							const textContent = layer.text;

							// --- Determine strictly the derived bounding box dimensions ---
							let derivedWidth = layer.width;
							let derivedHeight = layer.height;

							if (layer.virtualVideo) {
								const ops = layer.virtualVideo.operations || [];

								if (layer.autoDimensions) {
									// Reverse through operations to find the latest one with dimension metadata
									const latestOpWithMeta = [...ops]
										.reverse()
										.find(
											(op) =>
												op.metadata?.width !== undefined &&
												op.metadata?.height !== undefined,
										);

									if (latestOpWithMeta?.metadata) {
										derivedWidth = latestOpWithMeta.metadata.width;
										derivedHeight = latestOpWithMeta.metadata.height;
									}
								}
							}
							// --------------------------------------------------------------

							const {
								x: animX,
								y: animY,
								scale: animScale,
								rotation: animRotation,
								opacity: animOpacity,
								volume: animVolume,
							} = calculateLayerTransform(layer, frame, fps, {
								w: resolvedViewportW,
								h: resolvedViewportH,
							});

							const style: React.CSSProperties = {
								position: "absolute",
								left: animX,
								top: animY,
								width: derivedWidth,
								height: derivedHeight,
								transform: `rotate(${animRotation}deg) scale(${animScale})`,
								transformOrigin: "center center",
								boxSizing: "border-box",
								opacity: animOpacity,
								backgroundColor: layer.backgroundColor,
								borderColor: layer.borderColor,
								borderWidth: layer.borderWidth,
								borderRadius: layer.borderRadius,
								borderStyle: layer.borderWidth ? "solid" : undefined,
								overflow: "hidden", // Bounds the component seamlessly
							};

							return (
								<Sequence
									key={layer.id}
									from={layer.startFrame}
									durationInFrames={duration}
									layout="none"
								>
									{layer.type === "Video" && layer.virtualVideo && (
										<div style={style}>
											{/* Delegate rendering entirely to SingleClipComposition */}
											<SingleClipComposition
												virtualVideo={layer.virtualVideo}
											/>
										</div>
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
												fontStyle: layer.fontStyle,
												fontWeight: layer.fontWeight,
												textDecoration: layer.textDecoration,
												lineHeight: layer.lineHeight ?? 1.2,
												letterSpacing: layer.letterSpacing
													? `${layer.letterSpacing}px`
													: undefined,
												textAlign:
													(layer.align as "left" | "center" | "right") ??
													"left",
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
						})}
					</div>
				</foreignObject>
			</svg>
		</AbsoluteFill>
	);
};
