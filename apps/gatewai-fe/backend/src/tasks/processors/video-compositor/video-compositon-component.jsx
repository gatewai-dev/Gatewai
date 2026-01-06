import {
	AbsoluteFill,
	Audio,
	Img,
	Sequence,
	useVideoConfig,
	Video,
} from "remotion";

const DynamicComposition = ({ config, inputDataMap }) => {
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

				const baseStyle = {
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
					const verticalAlignMap = {
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

				const getAssetUrl = (input) => {
					const fileData = input.outputItem?.data;
					if (fileData?.entity?.id) {
						return GetAssetEndpoint(fileData.entity.id);
					}
					if (fileData?.processData?.dataUrl) {
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

export { DynamicComposition };
