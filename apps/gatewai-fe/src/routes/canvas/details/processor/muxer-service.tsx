import type {
	FileData,
	VideoCompositorLayer,
	VideoCompositorNodeConfig,
} from "@gatewai/types";
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
import { GetAssetEndpoint } from "@/utils/file";
import type { NodeProcessorParams } from "./types";

// Types for supported Animations

const DynamicComposition: React.FC<{
	config: VideoCompositorNodeConfig;
	inputDataMap: NodeProcessorParams["inputs"];
}> = ({ config, inputDataMap }) => {
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

	return (
		<AbsoluteFill
			className="media-container"
			style={{ backgroundColor: config.background ?? "black" }}
		>
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
						case "slide-in-left": {
							const dirX = -1;
							animX += dirX * viewportWidth * (1 - progress);
							break;
						}
						case "slide-in-right": {
							const dirX = 1;
							animX += dirX * viewportWidth * (1 - progress);
							break;
						}
						case "slide-in-top": {
							const dirY = -1;
							animY += dirY * viewportHeight * (1 - progress);
							break;
						}
						case "slide-in-bottom": {
							const dirY = 1;
							animY += dirY * viewportHeight * (1 - progress);
							break;
						}
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
					transform: `rotate(${animRotation}deg) scale(${animScale})`,
					opacity: animOpacity,
				};

				const getAssetUrl = () => {
					const fileData = input.outputItem?.data as FileData;
					return fileData.entity?.id
						? GetAssetEndpoint(fileData.entity)
						: fileData.processData?.dataUrl;
				};

				const assetSrc = getAssetUrl();
				return (
					<Sequence
						from={from}
						durationInFrames={layerDuration}
						key={layer.inputHandleId}
					>
						{input.outputItem?.type === "Video" && assetSrc && (
							<Video
								src={assetSrc}
								style={{ ...baseStyle, objectFit: "cover" }}
								volume={layer.volume ?? 1}
							/>
						)}
						{input.outputItem?.type === "Image" && assetSrc && (
							<Img
								src={assetSrc}
								style={{ ...baseStyle, objectFit: "cover" }}
							/>
						)}
						{input.outputItem?.type === "Text" && (
							<div
								style={{
									...baseStyle,
									fontFamily: layer.fontFamily ?? "sans-serif",
									fontSize: `${layer.fontSize ?? 16}px`,
									fontStyle: layer.fontStyle,
									textDecoration: layer.textDecoration,
									color: layer.fill ?? "white",
									textAlign: layer.align ?? "left",
									display: "flex",
									flexDirection: "column",
									justifyContent: "center",
									alignItems: "flex-start",
									lineHeight: 1.2,
									whiteSpace: "pre-wrap",
									textShadow: "0 2px 4px rgba(0,0,0,0.1)",
								}}
							>
								{String(input.outputItem.data)}
							</div>
						)}
						{input.outputItem?.type === "Audio" && assetSrc && (
							<Audio src={assetSrc} volume={layer.volume ?? 1} />
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

		// Ensure layerUpdates exists; if not provided (e.g., user didn't open editor), generate defaults based on inputs
		const layerUpdates: Record<string, VideoCompositorLayer> =
			config.layerUpdates ?? {};

		// If no layer updates are provided, create default layers for all inputs
		if (Object.keys(layerUpdates).length === 0) {
			let maxZ = 0; // Start zIndex from 0 and increment for stacking
			const inputKeys = Object.keys(inputDataMap).sort();
			for (const inputHandleId of inputKeys) {
				const input = inputDataMap[inputHandleId];
				if (!input?.outputItem) continue;

				const item = input.outputItem;
				const fileData = item.data as FileData;
				const processData = fileData.processData;

				// Default dimensions: use processData if available, else full viewport
				let defaultWidth = processData?.width ?? width;
				let defaultHeight = processData?.height ?? height;

				// Center position by default
				let defaultX = (width - defaultWidth) / 2;
				let defaultY = (height - defaultHeight) / 2;

				const defaultLayer: VideoCompositorLayer = {
					inputHandleId,
					x: defaultX,
					y: defaultY,
					width: defaultWidth,
					height: defaultHeight,
					scale: 1,
					rotation: 0,
					opacity: 1,
					zIndex: ++maxZ,
					startFrame: 0,
					// durationInFrames will be determined later based on media or default
				};

				// Type-specific defaults
				if (item.type === "Text") {
					defaultLayer.fontFamily = "sans-serif";
					defaultLayer.fontSize = 60;
					defaultLayer.fill = "white";
					defaultLayer.align = "center";
					// Override dimensions for text
					defaultWidth = 600;
					defaultHeight = 200;
					defaultLayer.width = defaultWidth;
					defaultLayer.height = defaultHeight;
					defaultX = (width - defaultWidth) / 2;
					defaultY = (height - defaultHeight) / 2;
					defaultLayer.x = defaultX;
					defaultLayer.y = defaultY;
				} else if (item.type === "Audio") {
					defaultLayer.volume = 1;
					// Audio has no visual component
					defaultLayer.width = 0;
					defaultLayer.height = 0;
					defaultLayer.x = 0;
					defaultLayer.y = 0;
				} else if (item.type === "Video" || item.type === "Image") {
					defaultLayer.volume = item.type === "Video" ? 1 : undefined;
					// Use full size if no processData, but centered if smaller
				}

				layerUpdates[inputHandleId] = defaultLayer;
			}
		}

		// Create a mutable copy of layerUpdates for adjustments
		const layerUpdatesCopy: Record<string, VideoCompositorLayer> = {};
		const mediaPromises: Promise<void>[] = [];

		for (const layerKey in layerUpdates) {
			const layer = layerUpdates[layerKey];
			// Shallow copy the layer to allow modifications without affecting the original
			layerUpdatesCopy[layerKey] = { ...layer };

			const input = inputDataMap[layer.inputHandleId];
			if (!input?.outputItem) continue;

			const item = input.outputItem;

			// Handle duration adjustments for Video or Audio
			if (item.type === "Video" || item.type === "Audio") {
				const promise = this.getMediaDurationAsSec(
					item.data as FileData,
					item.type,
				).then((durSec) => {
					const actualFrames = Math.floor(durSec * fps);
					// Use specified duration if provided, but clamp to actual media length
					let durationInFrames = actualFrames;
					if (layer.durationInFrames != null) {
						durationInFrames = Math.min(layer.durationInFrames, actualFrames);
					}
					layerUpdatesCopy[layerKey].durationInFrames = Math.max(
						1,
						durationInFrames,
					); // Ensure at least 1 frame
				});
				mediaPromises.push(promise);
			} else {
				// For Images/Text, default to 5 seconds if not specified
				if (layer.durationInFrames == null) {
					layerUpdatesCopy[layerKey].durationInFrames = fps * 5;
				}
			}
		}

		// Wait for all media duration fetches to complete
		await Promise.all(mediaPromises);

		// Create a copy of config with updated layers
		const configCopy = {
			...config,
			layerUpdates: layerUpdatesCopy,
		};

		// Calculate total composition duration as the max end frame across all layers
		const totalDuration = Math.max(
			...Object.values(layerUpdatesCopy).map(
				(l) => (l.startFrame ?? 0) + (l.durationInFrames ?? 0),
			),
			1, // Ensure at least 1 frame
		);

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
				defaultProps: { config: configCopy, inputDataMap },
			},
			inputProps: { config: configCopy, inputDataMap },
		});

		if (signal?.aborted) throw new Error("Aborted");

		const blob = await getBlob();
		return { dataUrl: URL.createObjectURL(blob), width, height };
	}

	private async getMediaDurationAsSec(
		fileData: FileData,
		type: "Video" | "Audio",
	): Promise<number> {
		// Check for pre-existing duration metadata (in milliseconds)
		const existingDurationMs =
			fileData?.entity?.duration ?? fileData.processData?.duration;
		if (existingDurationMs) {
			return Number(existingDurationMs) / 1000;
		}

		// Fallback to loading the media element to get duration
		const url = fileData.entity?.id
			? GetAssetEndpoint(fileData.entity)
			: fileData.processData?.dataUrl;
		if (!url) {
			throw new Error("Missing source URL for media duration retrieval");
		}

		return new Promise((resolve, reject) => {
			const el = document.createElement(type === "Video" ? "video" : "audio");
			el.src = url;
			el.onloadedmetadata = () => resolve(el.duration || 0); // Fallback to 0 if duration is NaN or undefined
			el.onerror = (err) =>
				reject(new Error(`Failed to load media metadata: ${err}`));
		});
	}
}

export const remotionService = new RemotionWebProcessorService();
