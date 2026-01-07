import { Buffer } from "node:buffer";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type {
	FileData,
	VideoCompositorLayer,
	VideoCompositorNodeConfig,
} from "@gatewai/types";
import { bundle } from "@remotion/bundler";
import { renderMedia } from "@remotion/renderer";
import getVideoDurationInSeconds from "get-video-duration";
import type React from "react";
import { lazy } from "react";
import {
	AbsoluteFill,
	Audio,
	Img,
	interpolate,
	Sequence,
	spring,
	useCurrentFrame,
	useVideoConfig,
	Video,
} from "remotion";
import { GetAssetEndpoint } from "@/utils/file";
import type { NodeProcessorParams } from "./types";

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
	const sortedLayers = [...layers].sort(
		(a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0),
	);

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

export class RemotionNodeProcessorService {
	private serveUrl: string | null = null;

	constructor(private entryPoint: string) {} // entryPoint is the path to this file, e.g., require.resolve('./this-file.tsx')

	private async init() {
		if (!this.serveUrl) {
			this.serveUrl = await bundle(this.entryPoint);
		}
	}

	async processVideo(
		config: VideoCompositorNodeConfig,
		inputDataMap: NodeProcessorParams["inputs"],
		signal?: AbortSignal,
	): Promise<{ dataUrl: string; width: number; height: number }> {
		await this.init();

		const width = config.width ?? 1280;
		const height = config.height ?? 720;
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
					const promise = this.getMediaDuration(
						input.outputItem.data as FileData,
						input.outputItem.type as "Video" | "Audio",
					).then((durSec) => {
						layer.durationInFrames = Math.floor(durSec * fps);
					});
					mediaDurationPromises.push(promise);
				} else {
					layer.durationInFrames = 150; // Default ~5s at 30fps if unknown
				}
			}
		}

		await Promise.all(mediaDurationPromises);
		const totalDuration = Math.max(
			...layers.map((l) => (l.startFrame ?? 0) + (l.durationInFrames ?? 0)),
			1,
		);

		const composition = {
			id: "dynamic-video",
			component: lazy(
				() => new Promise((res) => res({ default: DynamicComposition })),
			),
			durationInFrames: totalDuration,
			fps,
			width,
			height,
			defaultProps: { config, inputDataMap },
		};

		const tempDir = os.tmpdir();
		const outputLocation = path.join(
			tempDir,
			`remotion-output-${Date.now()}.mp4`,
		);

		await renderMedia({
			codec: "h264",
			serveUrl: this.serveUrl!,
			composition,
			outputLocation,
			inputProps: { config, inputDataMap },
			signal,
		});

		if (signal?.aborted) throw new Error("Aborted");

		const buffer = fs.readFileSync(outputLocation);
		fs.unlinkSync(outputLocation); // Clean up temp file

		const dataUrl = `data:video/mp4;base64,${buffer.toString("base64")}`;

		return { dataUrl, width, height };
	}

	private async getMediaDuration(
		fileData: FileData,
		type: "Video" | "Audio",
	): Promise<number> {
		const url = fileData.entity?.id
			? GetAssetEndpoint(fileData.entity.id)
			: fileData.processData?.dataUrl;
		const existing =
			fileData?.entity?.duration ?? fileData.processData?.duration;
		if (existing) return existing;
		if (!url) throw new Error("Missing source URL");

		if (url.startsWith("data:")) {
			const base64Data = url.split(",")[1];
			const buffer = Buffer.from(base64Data, "base64");
			return getVideoDurationInSeconds(buffer);
		} else {
			return getVideoDurationInSeconds(url);
		}
	}
}

export const remotionService = new RemotionNodeProcessorService(
	require.resolve("./this-file.tsx"),
); // Adjust to actual file path
