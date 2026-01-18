import type { CompositorLayer, CompositorNodeConfig } from "@gatewai/types";
import Konva from "konva";
import { GetFontAssetUrl } from "@/utils/file";

// Sync with server defaults
const DEFAULTS = {
	FONT_FAMILY: "Inter",
	FONT_SIZE: 64,
	FILL: "#ffffff",
	LINE_HEIGHT: 1.1,
	ALIGN: "left",
	VERTICAL_ALIGN: "top",
	LETTER_SPACING: 0,
};

const processCompositor = async (
	config: CompositorNodeConfig,
	inputs: Record<string, { type: "Image" | "Text"; value: string }>,
	signal?: AbortSignal,
): Promise<{ dataUrl: Blob; width: number; height: number }> => {
	if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");

	const width = config.width ?? 1080;
	const height = config.height ?? 1080;

	const container = document.createElement("div");
	const stage = new Konva.Stage({
		container: container,
		width: width,
		height: height,
	});

	const layer = new Konva.Layer();
	stage.add(layer);

	const explicitLayers = Object.values(config.layerUpdates || {});
	const allLayers: CompositorLayer[] = [...explicitLayers];

	let maxZ = Math.max(...explicitLayers.map((l) => l.zIndex ?? 0), 0);

	// Default layer generation matching server-side logic
	for (const [handleId, input] of Object.entries(inputs)) {
		if (explicitLayers.some((l) => l.inputHandleId === handleId)) continue;

		const defaultLayer: CompositorLayer = {
			id: handleId,
			inputHandleId: handleId,
			type: input.type,
			x: 0,
			y: 0,
			rotation: 0,
			opacity: 1,
			lockAspect: true,
			blendMode: "source-over",
			zIndex: ++maxZ,
		};

		if (input.type === "Text") {
			Object.assign(defaultLayer, {
				fontFamily: DEFAULTS.FONT_FAMILY,
				fontSize: DEFAULTS.FONT_SIZE,
				fill: DEFAULTS.FILL,
				letterSpacing: DEFAULTS.LETTER_SPACING,
				lineHeight: DEFAULTS.LINE_HEIGHT,
				align: DEFAULTS.ALIGN,
				verticalAlign: DEFAULTS.VERTICAL_ALIGN,
			});
		} else {
			const img = new Image();
			img.crossOrigin = "Anonymous";
			img.src = input.value;

			await new Promise<void>((resolve, reject) => {
				img.onload = () => {
					defaultLayer.width = Math.round(img.width);
					defaultLayer.height = Math.round(img.height);
					resolve();
				};
				img.onerror = reject;
			});
		}

		allLayers.push(defaultLayer);
	}

	if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");

	const sortedLayers = allLayers.sort(
		(a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0),
	);

	// 3. Collect and Load Fonts
	const fontsToLoad = new Set<string>();
	for (const layerConfig of sortedLayers) {
		if (layerConfig.type === "Text" && layerConfig.fontFamily) {
			fontsToLoad.add(layerConfig.fontFamily);
		}
	}

	const fontLoadPromises = Array.from(fontsToLoad).map(async (fontFamily) => {
		if (document.fonts.check(`16px "${fontFamily}"`)) return;
		try {
			const fontUrl = GetFontAssetUrl(fontFamily);
			const fontFace = new FontFace(fontFamily, `url(${fontUrl})`);
			const loadedFace = await fontFace.load();
			document.fonts.add(loadedFace);
		} catch (err) {
			console.warn(`Failed to load font: ${fontFamily}`, err);
		}
	});

	await Promise.all(fontLoadPromises);
	await document.fonts.ready;

	// 4. Render Loop
	for (const layerConfig of sortedLayers) {
		if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");

		const inputData = inputs[layerConfig.inputHandleId];
		if (!inputData) continue;
		if (layerConfig.opacity === 0) continue;

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
				opacity: layerConfig.opacity ?? 1,
				width: layerConfig.width ?? width,
				height: layerConfig.height,
				rotation: layerConfig.rotation ?? 0,
				globalCompositeOperation:
					(layerConfig.blendMode as GlobalCompositeOperation) ?? "source-over",
			});
			layer.add(kImage);
		} else if (inputData.type === "Text") {
			const fontSize = layerConfig.fontSize ?? DEFAULTS.FONT_SIZE;
			const align = layerConfig.align ?? DEFAULTS.ALIGN;
			const hasExplicitWidth = !!(layerConfig.width && layerConfig.width > 0);

			const kText = new Konva.Text({
				text: inputData.value,
				x: layerConfig.x ?? 0,
				y: layerConfig.y ?? 0,
				opacity: layerConfig.opacity ?? 1,
				rotation: layerConfig.rotation ?? 0,
				fontSize: fontSize,
				fontFamily: layerConfig.fontFamily ?? DEFAULTS.FONT_FAMILY,
				fontStyle: layerConfig.fontStyle ?? "normal",
				textDecoration: layerConfig.textDecoration ?? "",
				fill: layerConfig.fill ?? DEFAULTS.FILL,
				letterSpacing: layerConfig.letterSpacing ?? DEFAULTS.LETTER_SPACING,
				lineHeight: layerConfig.lineHeight ?? DEFAULTS.LINE_HEIGHT,
				width: hasExplicitWidth ? layerConfig.width : undefined,
				height:
					layerConfig.height && layerConfig.height > 0
						? layerConfig.height
						: undefined,
				align: align,
				verticalAlign: layerConfig.verticalAlign ?? DEFAULTS.VERTICAL_ALIGN,
				wrap: hasExplicitWidth ? "word" : "none",
				globalCompositeOperation:
					(layerConfig.blendMode as GlobalCompositeOperation) ?? "source-over",
			});

			kText.listening(false);
			layer.add(kText);
		}
	}

	layer.draw();
	if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");

	const blob = await new Promise<Blob>((resolve, reject) => {
		stage.toBlob({
			pixelRatio: 1,
			callback(blob) {
				if (blob) return resolve(blob);
				return reject();
			},
		});
	});

	stage.destroy();
	container.remove();

	return { dataUrl: blob, width, height };
};

export { processCompositor };
