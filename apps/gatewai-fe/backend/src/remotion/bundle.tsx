import type {
	FileData,
	VideoCompositorLayer,
	VideoCompositorNodeConfig,
} from "@gatewai/types";
import { bundle } from "@remotion/bundler";
import { loadFont } from "@remotion/fonts";
import { renderMedia, selectComposition } from "@remotion/renderer";
import type React from "react";
import { useEffect, useMemo } from "react";
import {
	AbsoluteFill,
	Audio,
	Composition,
	continueRender,
	delayRender,
	Img,
	interpolate,
	registerRoot,
	Sequence,
	spring,
	useCurrentFrame,
	useVideoConfig,
	Video,
} from "remotion";
import { GetAssetEndpoint } from "@/utils/file";
import type { NodeProcessorParams } from "./types";

// Types for supported Animations

const getMediaDuration = async (
	fileData: FileData,
	type: "Video" | "Audio",
): Promise<number> => {
	const url = fileData.entity?.id
		? GetAssetEndpoint(fileData.entity.id)
		: fileData.processData?.dataUrl;
	const existing = fileData?.entity?.duration ?? fileData.processData?.duration;
	if (existing) return existing;
	if (!url) throw new Error("Missing source URL");

	return new Promise((resolve, reject) => {
		const el = document.createElement(type === "Video" ? "video" : "audio");
		el.src = url;
		el.onloadedmetadata = () => resolve(el.duration);
		el.onerror = reject;
	});
};

const calculateMetadata = async ({
	props,
}: {
	props: {
		config: VideoCompositorNodeConfig;
		inputDataMap: NodeProcessorParams["inputs"];
		fontUrls?: Record<string, string>;
	};
}) => {
	const { config, inputDataMap } = props;
	const fps = config.FPS ?? 24;
	const layers = Object.values(
		config.layerUpdates ?? {},
	) as VideoCompositorLayer[];
	const mediaDurationPromises: Promise<any>[] = [];

	for (const layer of layers) {
		const input = inputDataMap[layer.inputHandleId];
		if (!input) continue;

		if (layer.durationInFrames == null) {
			if (
				input.outputItem?.type === "Video" ||
				input.outputItem?.type === "Audio"
			) {
				const promise = getMediaDuration(
					input.outputItem.data as FileData,
					input.outputItem.type as "Video" | "Audio",
				).then((durSec) => {
					layer.durationInFrames = Math.floor(durSec * fps);
				});
				mediaDurationPromises.push(promise);
			} else {
				layer.durationInFrames = 150; // Default 5s at 30fps if unknown
			}
		}
	}

	await Promise.all(mediaDurationPromises);
	const totalDuration = Math.max(
		...layers.map((l) => (l.startFrame ?? 0) + (l.durationInFrames ?? 0)),
		1,
	);

	return {
		durationInFrames: totalDuration,
		fps: config.FPS ?? 24,
		width: config.width ?? 1280,
		height: config.height ?? 720,
	};
};

const DynamicComposition: React.FC<{
	config: VideoCompositorNodeConfig;
	inputDataMap: NodeProcessorParams["inputs"];
	fontUrls: Record<string, string>;
}> = ({ config, inputDataMap, fontUrls }) => {
	const {
		fps,
		width: viewportWidth,
		height: viewportHeight,
	} = useVideoConfig();
	const frame = useCurrentFrame();

	// Note: z-index is unsupported. We solve this by ordering the DOM elements.
	const layers = Object.values(
		config.layerUpdates ?? {},
	) as VideoCompositorLayer[];
	const sortedLayers = useMemo(
		() => [...layers].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0)),
		[layers],
	);

	const uniqueFonts = useMemo(() => {
		const set = new Set<string>();
		for (const layer of layers) {
			const input = inputDataMap[layer.inputHandleId];
			if (input?.outputItem?.type === "Text" && layer.fontFamily) {
				set.add(layer.fontFamily);
			}
		}
		return Array.from(set);
	}, [layers, inputDataMap]);

	useEffect(() => {
		if (uniqueFonts.length === 0) return;

		const handle = delayRender("Loading fonts");

		Promise.all(
			uniqueFonts.map((fontFamily) =>
				loadFont({
					family: fontFamily,
					url: fontUrls[fontFamily],
				}),
			),
		)
			.then(() => {
				continueRender(handle);
			})
			.catch((err) => {
				console.error("Font loading error", err);
				continueRender(handle);
			});
	}, [uniqueFonts, fontUrls]);

	return (
		<AbsoluteFill style={{ backgroundColor: config.background ?? "black" }}>
			{sortedLayers.map((layer) => {
				const input = inputDataMap[layer.inputHandleId];
				if (!input) return null;

				const from = layer.startFrame ?? 0;
				const layerDuration = layer.durationInFrames ?? 0;
				const relativeFrame = frame - from;

				// Animation State
				let animX = layer.x ?? 0;
				let animY = layer.y ?? 0;
				let animScale = layer.scale ?? 1;
				let animRotation = layer.rotation ?? 0;
				let animOpacity = layer.opacity ?? 1;

				(layer.animations ?? []).forEach((anim) => {
					const durFrames = anim.value * fps;
					const isOut = anim.type.includes("-out");
					const startAnimFrame = isOut ? layerDuration - durFrames : 0;
					const endAnimFrame = isOut ? layerDuration : durFrames;

					if (relativeFrame < startAnimFrame || relativeFrame > endAnimFrame)
						return;

					const progress = interpolate(
						relativeFrame,
						[startAnimFrame, endAnimFrame],
						[0, 1],
						{ extrapolateLeft: "clamp", extrapolateRight: "clamp" },
					);

					switch (anim.type) {
						case "fade-in":
							animOpacity *= progress;
							break;
						case "fade-out":
							animOpacity *= 1 - progress;
							break;
						case "slide-in-left":
							animX += -viewportWidth * (1 - progress);
							break;
						case "slide-in-right":
							animX += viewportWidth * (1 - progress);
							break;
						case "slide-in-top":
							animY += -viewportHeight * (1 - progress);
							break;
						case "slide-in-bottom":
							animY += viewportHeight * (1 - progress);
							break;
						case "zoom-in":
							animScale *= progress;
							break;
						case "zoom-out":
							animScale *= 1 - progress;
							break;
						case "rotate-cw":
							animRotation += 360 * progress;
							break;
						case "rotate-ccw":
							animRotation -= 360 * progress;
							break;
						case "bounce": {
							const b = spring({
								frame: relativeFrame - startAnimFrame,
								fps,
								config: { damping: 10, stiffness: 100 },
								durationInFrames: durFrames,
							});
							animScale *= b;
							break;
						}
						case "shake":
							animX += 15 * Math.sin(relativeFrame * 0.5) * (1 - progress);
							break;
					}
				});

				const baseStyle: React.CSSProperties = {
					position: "absolute",
					left: animX,
					top: animY,
					width: layer.width ?? "auto",
					height: layer.height ?? "auto",
					// Transform, scale, rotate, opacity are supported in Remotion's Node.js renderer
					transform: `rotate(${animRotation}deg) scale(${animScale})`,
					opacity: animOpacity,
				};

				const getAssetUrl = () => {
					const fileData = input.outputItem?.data as FileData;
					return fileData.entity?.id
						? GetAssetEndpoint(fileData.entity.id)
						: fileData.processData?.dataUrl;
				};

				const inputSrc = getAssetUrl();

				return (
					<Sequence
						from={from}
						durationInFrames={layerDuration}
						key={layer.inputHandleId}
					>
						{input.outputItem?.type === "Video" && inputSrc && (
							<Video
								src={inputSrc}
								style={baseStyle}
								volume={layer.volume ?? 1}
							/>
						)}
						{input.outputItem?.type === "Image" && inputSrc && (
							<Img src={inputSrc} style={baseStyle} />
						)}
						{input.outputItem?.type === "Text" && (
							<div
								style={{
									...baseStyle,
									fontFamily: layer.fontFamily ?? "sans-serif",
									fontSize: `${layer.fontSize ?? 16}px`,
									color: layer.fill ?? "white",
									textAlign: (layer.align as any) ?? "left",
									display: "flex",
									flexDirection: "column",
									justifyContent: "center",
								}}
							>
								{String(input.outputItem.data)}
							</div>
						)}
						{input.outputItem?.type === "Audio" && inputSrc && (
							<Audio src={inputSrc} volume={layer.volume ?? 1} />
						)}
					</Sequence>
				);
			})}
		</AbsoluteFill>
	);
};

const RemotionRoot: React.FC = () => {
	return (
		<Composition
			id="dynamic-video"
			component={DynamicComposition}
			calculateMetadata={calculateMetadata}
			durationInFrames={1}
			fps={30}
			width={1280}
			height={720}
			defaultProps={{
				config: {} as VideoCompositorNodeConfig,
				inputDataMap: {} as NodeProcessorParams["inputs"],
				fontUrls: {} as Record<string, string>,
			}}
		/>
	);
};

if (typeof document !== "undefined") {
	registerRoot(RemotionRoot);
}
