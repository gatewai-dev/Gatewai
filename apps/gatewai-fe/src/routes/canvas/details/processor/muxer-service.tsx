import type {
	FileData,
	OutputItem,
	VideoCompositorNodeConfig,
} from "@gatewai/types";
import { renderMediaOnWeb } from "@remotion/web-renderer";
import type React from "react";
import {
	AbsoluteFill,
	Audio,
	Img,
	Sequence,
	useVideoConfig,
	Video,
} from "remotion";
import { GetAssetEndpoint } from "@/utils/file";
import type { ConnectedInput, NodeProcessorParams } from "./types";

const DynamicComposition: React.FC<{
	config: VideoCompositorNodeConfig;
	inputDataMap: NodeProcessorParams["inputs"];
}> = ({ config, inputDataMap }) => {
	const { fps, durationInFrames } = useVideoConfig();

	const layers = Object.values(config.layerUpdates ?? {});
	const sortedLayers = layers.sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));

	return (
		<AbsoluteFill style={{ backgroundColor: config.background ?? "black" }}>
			{sortedLayers.map((layer) => {
				const input = inputDataMap[layer.inputHandleId];
				if (!input) return null;

				const from = layer.startFrame ?? 0;
				const layerDuration =
					layer.durationInFrames ??
					(layer.duration
						? Math.floor(layer.duration * fps)
						: durationInFrames);

				const baseStyle: React.CSSProperties = {
					position: "absolute",
					left: layer.x ?? 0,
					top: layer.y ?? 0,
					width: layer.width ?? "auto",
					height: layer.height ?? "auto",
					transform: `rotate(${layer.rotation ?? 0}deg)`,
				};

				let style = baseStyle;
				const volume = layer.volume ?? 1;

				if (input.outputItem?.type === "Text") {
					const verticalAlignMap: Record<string, string> = {
						top: "flex-start",
						middle: "center",
						bottom: "flex-end",
					};

					style = {
						...baseStyle,
						fontFamily: layer.fontFamily ?? "sans-serif",
						fontSize: `${layer.fontSize ?? 16}px`,
						color: layer.fill ?? "black",
						letterSpacing: `${layer.letterSpacing ?? 0}px`,
						lineHeight: layer.lineHeight ?? 1,
						textAlign: layer.align ?? "left",
						display: "flex",
						flexDirection: "column",
						justifyContent: verticalAlignMap[layer.verticalAlign ?? "top"],
					};
				}

				const getAssetUrl = (input: ConnectedInput) => {
					const fileData = input.outputItem?.data as FileData;
					if (fileData.entity?.id) {
						return GetAssetEndpoint(fileData.entity.id);
					}
					if (fileData.processData?.dataUrl) {
						return fileData.processData?.dataUrl;
					}
				};

				const inputSrc = getAssetUrl(input);

				return (
					<Sequence
						from={from}
						durationInFrames={layerDuration}
						key={`layer_${layer.inputHandleId}`}
					>
						{input.outputItem?.type === "Video" && inputSrc && (
							<Video src={inputSrc} style={style} volume={volume} />
						)}
						{input.outputItem?.type === "Image" && inputSrc && (
							<Img src={inputSrc} style={style} />
						)}
						{input.outputItem?.type === "Text" && (
							<div style={style}>{input.outputItem.data}</div>
						)}
						{input.outputItem?.type === "Audio" && inputSrc && (
							<Audio src={inputSrc} volume={volume} />
						)}
					</Sequence>
				);
			})}
		</AbsoluteFill>
	);
};

async function getMediaDuration(
	fileData: FileData,
	type: "Video" | "Audio",
): Promise<number> {
	return new Promise((resolve, reject) => {
		const url = fileData.entity?.id
			? GetAssetEndpoint(fileData.entity.id)
			: fileData.processData?.dataUrl;
		const existing =
			fileData?.entity?.duration ?? fileData.processData?.duration ?? 0;
		if (existing) {
			resolve(existing);
		}
		if (!url) {
			throw new Error("Missing url to get duration");
		}
		const element = document.createElement(
			type === "Video" ? "video" : "audio",
		);
		element.preload = "metadata";
		element.onloadedmetadata = () => {
			resolve(element.duration);
		};
		element.onerror = reject;
		element.src = url;
	});
}

export class RemotionWebProcessorService {
	async processVideo(
		config: VideoCompositorNodeConfig,
		inputDataMap: NodeProcessorParams["inputs"],
		signal?: AbortSignal,
	): Promise<{ dataUrl: string; width: number; height: number }> {
		const width = config.width ?? 1280;
		const height = config.height ?? 720;
		const fps = config.FPS ?? 24;

		// Compute effective durations and total durationInFrames
		const layers = Object.values(config.layerUpdates ?? {});

		const mediaDurationPromises: Promise<{
			inputHandleId: string;
			durFrames: number;
		}>[] = [];

		const effectiveLayers: {
			layer: (typeof layers)[0];
			durFrames: number;
			startFrame: number;
		}[] = [];

		for (const layer of layers) {
			const input = inputDataMap[layer.inputHandleId];
			if (!input) continue;

			const startFrame = layer.startFrame ?? 0;
			let durFrames: number | undefined;

			if (layer.durationInFrames != null) {
				durFrames = layer.durationInFrames;
			} else if (layer.duration != null) {
				durFrames = Math.floor(layer.duration * fps);
			} else if (
				input.outputItem?.type === "Video" ||
				input.outputItem?.type === "Audio"
			) {
				const promise = getMediaDuration(
					input.outputItem.data as FileData,
					input.outputItem?.type,
				)
					.then((durSec) => {
						const df = Math.floor(durSec * fps);
						return { inputHandleId: layer.inputHandleId, durFrames: df };
					})
					.catch((err) => {
						console.error(
							`Failed to get duration for ${layer.inputHandleId}: ${err.message}`,
						);
						return { inputHandleId: layer.inputHandleId, durFrames: 0 };
					});
				mediaDurationPromises.push(promise);
				continue;
			} else {
				// Text or Image without duration: will use total durationInFrames, skip for max calc
				continue;
			}

			effectiveLayers.push({ layer, durFrames, startFrame });
		}

		if (mediaDurationPromises.length > 0) {
			const mediaDurs = await Promise.all(mediaDurationPromises);
			for (const md of mediaDurs) {
				const layer = layers.find((l) => l.inputHandleId === md.inputHandleId);
				if (layer) {
					layer.durationInFrames = md.durFrames;
					const startFrame = layer.startFrame ?? 0;
					effectiveLayers.push({
						layer,
						durFrames: md.durFrames,
						startFrame,
					});
				}
			}
		}

		let maxEndFrame = 0;
		for (const el of effectiveLayers) {
			const end = el.startFrame + el.durFrames;
			maxEndFrame = Math.max(maxEndFrame, end);
		}

		const durationInFrames = maxEndFrame ?? 0;

		// 2. Render Media using the browser's WebCodecs API
		const { getBlob } = await renderMediaOnWeb({
			onProgress: (p) =>
				console.log(
					`Rendering: ${Math.round((p.encodedFrames / p.renderedFrames) * 100)}%`,
				),
			// This is the "Muxer" part - it encodes frames into a container
			codec: "h264",
			licenseKey: "free-license",
			composition: {
				id: "dynamic-video",
				component: DynamicComposition,
				durationInFrames,
				fps,
				width,
				height,
				calculateMetadata: null,
				// Pass data directly as props
				defaultProps: { config, inputDataMap },
			},
			inputProps: { config, inputDataMap },
		});

		if (signal?.aborted) throw new Error("Aborted");
		const blob = await getBlob();
		// 3. Convert Blob to DataURL (matching your image logic)
		const dataUrl = this.blobToObjectUrl(blob);

		return { dataUrl, width, height };
	}

	private blobToObjectUrl(blob: Blob): string {
		const url = URL.createObjectURL(blob);
		return url;
	}
}

export const remotionService = new RemotionWebProcessorService();
