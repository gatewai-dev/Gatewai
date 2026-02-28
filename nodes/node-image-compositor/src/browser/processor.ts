import {
	fontManager,
	GetAssetEndpoint,
	GetFontAssetUrl,
} from "@gatewai/core/browser";
import type { ConnectedInput, NodeProcessorParams } from "@gatewai/core/types";
import { COMPOSITOR_DEFAULTS, type FileData } from "@gatewai/core/types";
import type { IBrowserProcessor } from "@gatewai/node-sdk/browser";
import Konva from "konva";
import {
	type CompositorLayer,
	type CompositorNodeConfig,
	CompositorNodeConfigSchema,
} from "../shared/config.js";
import type { CompositorResult } from "../shared/index.js";

// ─── Type helpers ─────────────────────────────────────────────────────────────

type RasterType = "Image" | "SVG";
type LayerInputType = RasterType | "Text";

const isRasterType = (type: string): type is RasterType =>
	type === "Image" || type === "SVG";

// ─────────────────────────────────────────────────────────────────────────────

const getConnectedInputDataValue = (
	inputs: Record<string, ConnectedInput>,
	handleId: string,
): { type: LayerInputType; value: string } | null => {
	const input = inputs[handleId];
	if (!input || !input.connectionValid || !input.outputItem) return null;

	if (isRasterType(input.outputItem.type)) {
		const fileData = input.outputItem.data as FileData;
		const url = fileData?.entity
			? GetAssetEndpoint(fileData.entity)
			: fileData?.processData?.dataUrl;
		if (url) return { type: input.outputItem.type as RasterType, value: url };
	} else if (input.outputItem.type === "Text") {
		const text = input.outputItem.data;
		if (text !== undefined) return { type: "Text", value: String(text) };
	}

	return null;
};

export class ImageCompositorBrowserProcessor implements IBrowserProcessor {
	async process({
		node,
		inputs,
		signal,
		context,
	}: NodeProcessorParams): Promise<CompositorResult | null> {
		const validatedConfig = CompositorNodeConfigSchema.parse(node.config);
		const inputDataMap: Record<
			string,
			{ type: LayerInputType; value: string }
		> = {};

		Object.keys(inputs).forEach((inputHandleId) => {
			const data = getConnectedInputDataValue(inputs, inputHandleId);
			if (data) inputDataMap[inputHandleId] = data;
		});

		const result = await processCompositor(
			validatedConfig,
			inputDataMap,
			signal,
		);
		const outputHandle = context.getOutputHandle("Image");
		if (!outputHandle) throw new Error("Missing output handle");

		const compositorUrl = URL.createObjectURL(result.dataUrl);
		context.registerObjectUrl(compositorUrl);

		return {
			selectedOutputIndex: 0,
			outputs: [
				{
					items: [
						{
							type: "Image",
							data: {
								processData: {
									dataUrl: compositorUrl,
									width: result.width,
									height: result.height,
								},
							},
							outputHandleId: outputHandle,
						},
					],
				},
			],
		};
	}
}

// ─── Raster rendering helper ──────────────────────────────────────────────────

/**
 * Loads a raster source (Image or SVG) into a Konva.Image node.
 * SVGs are loaded identically to raster images — browsers render both natively
 * via HTMLImageElement; Konva is agnostic to the underlying format.
 */
const loadRasterNode = (
	url: string,
	layerConfig: CompositorLayer,
): Promise<Konva.Image> =>
	new Promise((resolve, reject) => {
		const img = new Image();
		img.crossOrigin = "Anonymous";
		img.onload = () => {
			resolve(
				new Konva.Image({
					image: img,
					x: layerConfig.x ?? 0,
					y: layerConfig.y ?? 0,
					opacity: layerConfig.opacity ?? 1,
					width: layerConfig.width ?? img.width,
					height: layerConfig.height ?? img.height,
					rotation: layerConfig.rotation ?? 0,
					stroke: layerConfig.stroke,
					strokeWidth:
						layerConfig.strokeWidth ?? COMPOSITOR_DEFAULTS.STROKE_WIDTH,
					cornerRadius:
						layerConfig.cornerRadius ?? COMPOSITOR_DEFAULTS.CORNER_RADIUS,
					globalCompositeOperation:
						(layerConfig.blendMode as GlobalCompositeOperation) ??
						"source-over",
				}),
			);
		};
		img.onerror = reject;
		img.src = url;
	});

// ─────────────────────────────────────────────────────────────────────────────

const processCompositor = async (
	config: CompositorNodeConfig,
	inputs: Record<string, { type: LayerInputType; value: string }>,
	signal?: AbortSignal,
): Promise<{ dataUrl: Blob; width: number; height: number }> => {
	if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");

	const width = config.width ?? 1080;
	const height = config.height ?? 1080;

	const container = document.createElement("div");
	const stage = new Konva.Stage({ container, width, height });
	const layer = new Konva.Layer();
	stage.add(layer);

	const explicitLayers = Object.values(config.layerUpdates || {});
	const allLayers: CompositorLayer[] = [...explicitLayers];
	let maxZ = Math.max(...explicitLayers.map((l) => l.zIndex ?? 0), 0);

	// Default layer generation — mirrors editor initialisation logic
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
				fontFamily: COMPOSITOR_DEFAULTS.FONT_FAMILY,
				fontSize: COMPOSITOR_DEFAULTS.FONT_SIZE,
				fill: COMPOSITOR_DEFAULTS.FILL,
				letterSpacing: COMPOSITOR_DEFAULTS.LETTER_SPACING,
				lineHeight: COMPOSITOR_DEFAULTS.LINE_HEIGHT,
				align: COMPOSITOR_DEFAULTS.ALIGN,
				verticalAlign: COMPOSITOR_DEFAULTS.VERTICAL_ALIGN,
			});
		} else {
			// Raster (Image + SVG): resolve intrinsic dimensions
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

	// Collect and load fonts
	const fontsToLoad = new Set<string>();
	for (const l of sortedLayers) {
		if (l.type === "Text" && l.fontFamily) fontsToLoad.add(l.fontFamily);
	}
	await Promise.all(
		Array.from(fontsToLoad).map(async (fontFamily) => {
			try {
				await fontManager.loadFont(fontFamily, GetFontAssetUrl(fontFamily));
			} catch (err) {
				console.warn(`Failed to load font: ${fontFamily}`, err);
			}
		}),
	);
	await document.fonts.ready;

	// Render loop
	for (const layerConfig of sortedLayers) {
		if (signal?.aborted) throw new DOMException("Cancelled", "AbortError");

		const inputData = inputs[layerConfig.inputHandleId];
		if (!inputData || layerConfig.opacity === 0) continue;

		if (isRasterType(inputData.type)) {
			const kImage = await loadRasterNode(inputData.value, layerConfig);
			layer.add(kImage);
		} else if (inputData.type === "Text") {
			const hasExplicitWidth = !!(layerConfig.width && layerConfig.width > 0);
			const kText = new Konva.Text({
				text: inputData.value,
				x: layerConfig.x ?? 0,
				y: layerConfig.y ?? 0,
				opacity: layerConfig.opacity ?? 1,
				rotation: layerConfig.rotation ?? 0,
				fontSize: layerConfig.fontSize ?? COMPOSITOR_DEFAULTS.FONT_SIZE,
				fontFamily: layerConfig.fontFamily ?? COMPOSITOR_DEFAULTS.FONT_FAMILY,
				fontStyle: `${layerConfig.fontWeight ?? "normal"} ${layerConfig.fontStyle ?? "normal"}`,
				textDecoration: layerConfig.textDecoration ?? "",
				fill: layerConfig.fill ?? COMPOSITOR_DEFAULTS.FILL,
				letterSpacing:
					layerConfig.letterSpacing ?? COMPOSITOR_DEFAULTS.LETTER_SPACING,
				lineHeight: layerConfig.lineHeight ?? COMPOSITOR_DEFAULTS.LINE_HEIGHT,
				width: hasExplicitWidth ? layerConfig.width : undefined,
				height:
					layerConfig.height && layerConfig.height > 0
						? layerConfig.height
						: undefined,
				align: layerConfig.align ?? COMPOSITOR_DEFAULTS.ALIGN,
				verticalAlign:
					layerConfig.verticalAlign ?? COMPOSITOR_DEFAULTS.VERTICAL_ALIGN,
				padding: layerConfig.padding ?? COMPOSITOR_DEFAULTS.PADDING,
				stroke: layerConfig.stroke,
				strokeWidth:
					layerConfig.strokeWidth ?? COMPOSITOR_DEFAULTS.STROKE_WIDTH,
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
				return reject(new Error("stage.toBlob produced no output"));
			},
		});
	});

	stage.destroy();
	container.remove();

	return { dataUrl: blob, width, height };
};

export { processCompositor };
