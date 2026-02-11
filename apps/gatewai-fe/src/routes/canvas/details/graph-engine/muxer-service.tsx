import type {
	FileData,
	VideoCompositorLayer,
	VideoCompositorNodeConfig,
} from "@gatewai/core/types";
import { Audio, Video } from "@remotion/media";
import { renderMediaOnWeb } from "@remotion/web-renderer";
import type React from "react";
import { useMemo } from "react";
import {
	AbsoluteFill,
	Img,
	interpolate,
	Sequence,
	spring,
	useCurrentFrame,
	useVideoConfig,
} from "remotion";
import { GetAssetEndpoint } from "@/lib/file";
import { generateId } from "@/lib/idgen";
import type { NodeProcessorParams } from "./types";

const DynamicComposition: React.FC<{
	config: VideoCompositorNodeConfig;
	inputDataMap: NodeProcessorParams["inputs"];
}> = ({ config, inputDataMap }) => {
	const {
		fps,
		width: viewportWidth,
		height: viewportHeight,
		durationInFrames: totalDuration,
	} = useVideoConfig();
	const frame = useCurrentFrame();

	const layers = Object.values(
		config.layerUpdates ?? {},
	) as VideoCompositorLayer[];

	const sortedLayers = useMemo(
		() => [...layers].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0)),
		[layers],
	);

	return (
		<AbsoluteFill>
			{sortedLayers.map((layer) => {
				const input = inputDataMap[layer.inputHandleId];
				if (!input) return null;

				const startFrame = layer.startFrame ?? 0;
				const layerDuration = layer.durationInFrames ?? totalDuration;
				const relativeFrame = frame - startFrame;

				// Initial Properties
				let animX = layer.x ?? 0;
				let animY = layer.y ?? 0;
				let animScale = layer.scale ?? 1;
				let animRotation = layer.rotation ?? 0;
				let animOpacity = layer.opacity ?? 1;
				const animVolume = layer.volume ?? 1;

				// Match Editor Animation Logic
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
						case "slide-in-right": {
							const dirX = anim.type === "slide-in-left" ? -1 : 1;
							animX += dirX * viewportWidth * (1 - progress);
							break;
						}
						case "slide-in-top":
						case "slide-in-bottom": {
							const dirY = anim.type === "slide-in-top" ? -1 : 1;
							animY += dirY * viewportHeight * (1 - progress);
							break;
						}
						case "zoom-in":
							animScale *= progress; // Matches editor interpolate(progress, [0,1], [0,1])
							break;
						case "zoom-out":
							animScale *= 1 - progress;
							break;
						case "rotate-cw":
						case "rotate-ccw": {
							const dirRot = anim.type === "rotate-cw" ? 1 : -1;
							animRotation += dirRot * 360 * progress;
							break;
						}
						case "bounce": {
							const bounceProgress = spring({
								frame: relativeFrame - startAnimFrame,
								fps,
								config: { damping: 10, mass: 0.5, stiffness: 100 },
								durationInFrames: durFrames,
							});
							animScale *= bounceProgress;
							break;
						}
						case "shake": {
							const intensity = 20;
							const frequency = 10;
							const shakeProgress = 1 - progress;
							animX +=
								intensity *
								Math.sin(
									(relativeFrame * frequency * 2 * Math.PI) / durFrames,
								) *
								shakeProgress;
							break;
						}
					}
				});

				const style: React.CSSProperties = {
					position: "absolute",
					left: animX,
					top: animY,
					width: layer.width,
					height: layer.height,
					transform: `rotate(${animRotation}deg) scale(${animScale})`,
					opacity: animOpacity,
					// New Remotion-compatible properties
					backgroundColor: layer.backgroundColor,
					borderColor: layer.borderColor,
					borderWidth: layer.borderWidth,
					borderRadius: layer.borderRadius,
					borderStyle: layer.borderWidth ? "solid" : undefined,
				};

				const getAssetUrl = () => {
					const fileData = input.outputItem?.data as FileData;
					return fileData?.entity?.id
						? GetAssetEndpoint(fileData.entity)
						: fileData?.processData?.dataUrl;
				};

				const assetSrc = getAssetUrl();
				const textContent =
					input.outputItem?.type === "Text"
						? String(input.outputItem.data)
						: "";

				return (
					<Sequence
						key={layer.inputHandleId}
						from={startFrame}
						durationInFrames={Math.max(1, layerDuration)}
					>
						{input.outputItem?.type === "Video" && assetSrc && (
							<Video src={assetSrc} style={{ ...style }} volume={animVolume} />
						)}
						{input.outputItem?.type === "Image" && assetSrc && (
							<Img src={assetSrc} style={{ ...style, objectFit: "cover" }} />
						)}
						{input.outputItem?.type === "Audio" && assetSrc && (
							<Audio src={assetSrc} volume={animVolume} />
						)}
						{input.outputItem?.type === "Text" && (
							<div
								style={{
									...style,
									color: layer.fill,
									fontSize: layer.fontSize ?? 60,
									fontFamily: layer.fontFamily ?? "Inter",
									lineHeight: layer.lineHeight ?? 1.2,
									whiteSpace: "pre-wrap",
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

export class RemotionWebProcessorService {
	async processVideo(
		config: VideoCompositorNodeConfig,
		inputDataMap: NodeProcessorParams["inputs"],
		signal?: AbortSignal,
	): Promise<{ dataUrl: string; width: number; height: number }> {
		const width = config.width ?? 1280;
		const height = config.height ?? 720;
		const fps = config.FPS ?? 24;

		const layerUpdatesCopy: Record<string, VideoCompositorLayer> = {};
		const mediaPromises: Promise<void>[] = [];

		// Initialize layerUpdatesCopy from existing config or create defaults
		const hasConfigLayers =
			config.layerUpdates && Object.keys(config.layerUpdates).length > 0;

		if (hasConfigLayers) {
			for (const layerKey in config.layerUpdates) {
				const layer = config.layerUpdates[layerKey];
				layerUpdatesCopy[layerKey] = { ...layer };

				const input = inputDataMap[layer.inputHandleId];
				if (!input?.outputItem) continue;

				const item = input.outputItem;
				if (item.type === "Video" || item.type === "Audio") {
					const promise = this.getMediaDurationAsSec(
						item.data as FileData,
						item.type,
					).then((durSec) => {
						const actualFrames = Math.floor(durSec * fps);
						// Force clamp: never allow layer duration to be longer than the actual file
						const requestedDuration = layer.durationInFrames ?? actualFrames;
						layerUpdatesCopy[layerKey].durationInFrames = Math.max(
							1,
							Math.min(requestedDuration, actualFrames),
						);
					});
					mediaPromises.push(promise);
				} else if (layer.durationInFrames == null) {
					layerUpdatesCopy[layerKey].durationInFrames = fps * 5;
				}
			}
		} else {
			// Logic for generating default layers when no config exists
			let zIndex = 0;
			for (const inputHandleId in inputDataMap) {
				const input = inputDataMap[inputHandleId];
				if (!input?.outputItem) continue;

				const item = input.outputItem;
				const itemType = item.type;

				// Create a base default layer
				const defaultLayer: VideoCompositorLayer = {
					inputHandleId,
					zIndex:
						itemType === "Text" || itemType === "Image"
							? 100 + zIndex++
							: zIndex++,
					startFrame: 0,
					type: itemType as VideoCompositorLayer["type"],
					x: 0,
					y: 0,
					scale: 1,
					rotation: 0,
					id: generateId(),
					lockAspect: true,
					opacity: 1,
					volume: itemType === "Video" || itemType === "Audio" ? 1 : undefined,
				};

				if (itemType === "Video" || itemType === "Audio") {
					const promise = this.getMediaDurationAsSec(
						item.data as FileData,
						itemType,
					).then((durSec) => {
						defaultLayer.durationInFrames = Math.max(
							1,
							Math.floor(durSec * fps),
						);
						layerUpdatesCopy[inputHandleId] = defaultLayer;
					});
					mediaPromises.push(promise);
				} else {
					defaultLayer.durationInFrames = fps * 5;
					layerUpdatesCopy[inputHandleId] = defaultLayer;
				}
			}
		}

		await Promise.all(mediaPromises);

		// Calculate total duration based on the clamped layers
		const totalDuration = Math.max(
			...Object.values(layerUpdatesCopy).map(
				(l) => (l.startFrame ?? 0) + (l.durationInFrames ?? 0),
			),
			1,
		);

		const finalConfig = {
			...config,
			layerUpdates: layerUpdatesCopy,
		};

		const { getBlob } = await renderMediaOnWeb({
			signal,
			licenseKey: "free-license",
			composition: {
				id: "dynamic-video",
				component: DynamicComposition,
				durationInFrames: totalDuration,
				fps,
				width,
				height,
				defaultProps: { config: finalConfig, inputDataMap },
			},
			inputProps: { config: finalConfig, inputDataMap },
		});

		if (signal?.aborted) throw new Error("Aborted");

		const blob = await getBlob();
		return { dataUrl: URL.createObjectURL(blob), width, height };
	}

	private async getMediaDurationAsSec(
		fileData: FileData,
		type: "Video" | "Audio",
	): Promise<number> {
		const existingDurationMs =
			fileData?.entity?.duration ?? fileData.processData?.duration;
		if (existingDurationMs) {
			return Number(existingDurationMs) / 1000;
		}

		const url = fileData.entity?.id
			? GetAssetEndpoint(fileData.entity)
			: fileData.processData?.dataUrl;
		if (!url) {
			return 0;
		}

		return new Promise((resolve) => {
			const el = document.createElement(type === "Video" ? "video" : "audio");
			el.preload = "metadata";
			el.src = url;

			el.onloadedmetadata = () => {
				const duration = el.duration || 0;
				el.onloadedmetadata = null;
				el.onerror = null;
				el.src = "";
				el.load();
				resolve(duration);
			};

			el.onerror = () => {
				el.src = "";
				resolve(0);
			};
		});
	}
}

export const remotionService = new RemotionWebProcessorService();
