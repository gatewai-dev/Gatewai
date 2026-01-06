import type { OutputItem, VideoCompositorNodeConfig } from "@gatewai/types";
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

type VideoCompositorInputItemTypes =
	| OutputItem<"Video">
	| OutputItem<"Audio">
	| OutputItem<"Text">
	| OutputItem<"Image">;
const DynamicComposition: React.FC<{
	config: VideoCompositorNodeConfig;
	inputDataMap: Record<string, VideoCompositorInputItemTypes>;
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

				if (input.type === "Text") {
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

				return (
					<Sequence
						from={from}
						durationInFrames={layerDuration}
						key={`layer_${layer.inputHandleId}`}
					>
						{input.type === "Video" && (
							<Video src={input.data} style={style} volume={volume} />
						)}
						{input.type === "Image" && <Img src={input.data} style={style} />}
						{input.type === "Text" && <div style={style}>{input.data}</div>}
						{input.type === "Audio" && (
							<Audio src={input.data} volume={volume} />
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
		inputDataMap: Record<string, VideoCompositorInputItemTypes>,
		signal?: AbortSignal,
	): Promise<{ dataUrl: string; width: number; height: number }> {
		const width = config.width ?? 1280;
		const height = config.height ?? 720;
		const fps = config.FPS ?? 24;
		const durationInFrames = Math.floor((config.duration ?? 10) * fps);

		// 2. Render Media using the browser's WebCodecs API
		const { getBlob } = await renderMediaOnWeb({
			onProgress: (p) => console.log(`Rendering: ${Math.round(p * 100)}%`),
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
		const dataUrl = await this.blobToDataUrl(blob);

		return { dataUrl, width, height };
	}

	private blobToDataUrl(blob: Blob): Promise<string> {
		return new Promise((resolve) => {
			const reader = new FileReader();
			reader.onloadend = () => resolve(reader.result as string);
			reader.readAsDataURL(blob);
		});
	}
}
