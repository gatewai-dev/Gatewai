import type { CompositorNodeConfig } from "@gatewai/types";
import Konva from "konva";

const processCompositor = async (
	config: CompositorNodeConfig,
	inputs: Record<string, { type: "Image" | "Text"; value: string }>,
	signal?: AbortSignal,
): Promise<{ dataUrl: string; width: number; height: number }> => {
	if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");

	const width = config.width ?? 1024;
	const height = config.height ?? 1024;

	// 1. Create a headless Konva Stage
	const container = document.createElement("div");
	const stage = new Konva.Stage({
		container: container,
		width: width,
		height: height,
	});

	const layer = new Konva.Layer();
	stage.add(layer);

	// 2. Prepare Layers
	const explicitLayers = Object.values(config.layerUpdates || {});
	const allLayers = [...explicitLayers];

	for (const [handleId, input] of Object.entries(inputs)) {
		if (!explicitLayers.some((l) => l.inputHandleId === handleId)) {
			allLayers.push({
				id: handleId,
				inputHandleId: handleId,
				type: input.type,
				x: 0,
				y: 0,
				rotation: 0,
				opacity: 100,
				lockAspect: true,
				blendMode: "source-over",
				...(input.type === "Text"
					? {
							fontFamily: "Geist",
							fontSize: 60,
							fill: "#ffffff",
						}
					: {}),
			});
		}
	}

	const sortedLayers = allLayers.sort(
		(a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0),
	);

	// 3. Render Loop
	for (const layerConfig of sortedLayers) {
		if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");

		const inputData = inputs[layerConfig.inputHandleId];
		if (!inputData) continue;

		if (inputData.type === "Image") {
			const img = new Image();
			img.crossOrigin = "Anonymous";
			img.src = inputData.value;

			await new Promise((resolve, reject) => {
				img.onload = resolve;
				img.onerror = reject;
			});

			const kImage = new Konva.Image({
				image: img,
				x: layerConfig.x ?? 0,
				y: layerConfig.y ?? 0,
				opacity: layerConfig.opacity ?? 100,
				width: layerConfig.width ?? img.width,
				height: layerConfig.height ?? img.height,
				rotation: layerConfig.rotation ?? 0,
				globalCompositeOperation:
					(layerConfig.blendMode as GlobalCompositeOperation) ?? "source-over",
			});
			layer.add(kImage);
		} else if (inputData.type === "Text") {
			const fontSize = layerConfig.fontSize ?? 60;

			const kText = new Konva.Text({
				text: inputData.value,
				x: layerConfig.x ?? 0,
				y: layerConfig.y ?? 0,
				opacity: layerConfig.opacity ?? 100,
				rotation: layerConfig.rotation ?? 0,
				fontSize: fontSize,
				fontFamily: layerConfig.fontFamily ?? "Geist",
				fill: layerConfig.fill ?? "#ffffff",
				align: layerConfig.align ?? "left",
				letterSpacing: layerConfig.letterSpacing ?? 0,
				lineHeight: layerConfig.lineHeight ?? 1.2,
				width: layerConfig.width ?? width - (layerConfig.x ?? 0),
				wrap: "word",
				globalCompositeOperation:
					(layerConfig.blendMode as GlobalCompositeOperation) ?? "source-over",
			});

			kText.listening(false);
			layer.add(kText);
		}
	}

	layer.draw();

	const dataUrl = stage.toDataURL({ pixelRatio: 2 });

	// Cleanup
	stage.destroy();
	container.remove();

	return { dataUrl, width, height };
};

export { processCompositor };
