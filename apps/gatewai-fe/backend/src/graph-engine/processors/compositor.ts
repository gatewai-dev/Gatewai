import * as fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DataType } from "@gatewai/db";
import type {
	CompositorLayer,
	CompositorNodeConfig,
	FileData,
	GlobalCompositeOperationType,
	NodeResult,
} from "@gatewai/types";
import { COMPOSITOR_DEFAULTS } from "@gatewai/types";
import Konva from "konva";
import "konva/canvas-backend";
import { loadImage, registerFont } from "canvas";
import { ENV_CONFIG } from "../../config.js";
import { logImage } from "../../media-logger.js";
import { getImageBuffer, getImageDimensions } from "../../utils/image.js";
import { assertIsError } from "../../utils/misc.js";
import { uploadToTemporaryFolder } from "../../utils/storage.js";
import { getAllInputValuesWithHandle } from "../resolvers.js";
import type { NodeProcessor } from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Local defaults removed in favor of shared COMPOSITOR_DEFAULTS

/**
 * Resolves local font files and registers them with the canvas backend.
 * Konva/Canvas-Backend requires fonts to be registered globally.
 */
const setupFonts = async (layers: CompositorLayer[]) => {
	const families = new Set(
		layers
			.filter((l) => l.type === "Text")
			.map((l) => l.fontFamily ?? COMPOSITOR_DEFAULTS.FONT_FAMILY),
	);

	for (const family of families) {
		try {
			const fontDir = path.join(__dirname, "../../assets/fonts", family);
			const files = await fs.readdir(fontDir);
			const fontFile = files.find((f) => /\.(woff2|woff|ttf|otf)$/i.test(f));
			if (fontFile) {
				registerFont(path.join(fontDir, fontFile), { family });
			}
		} catch {
			// Font directory or file not found; fallback to system sans-serif
		}
	}
};

const compositorProcessor: NodeProcessor = async ({ node, data }) => {
	try {
		const config = node.config as CompositorNodeConfig;
		const width = config.width ?? 1080;
		const height = config.height ?? 1080;

		// 1. Unify Layers (Explicit from config + Implicit from inputs)
		const inputHandlesWithValues = getAllInputValuesWithHandle(data, node.id);
		const explicitLayers = Object.values(config.layerUpdates || {});
		let maxZ = Math.max(...explicitLayers.map((l) => l.zIndex ?? 0), 0);

		const allLayers: CompositorLayer[] = [...explicitLayers];

		for (const inputEntry of inputHandlesWithValues) {
			const handleId = inputEntry.handle?.id;
			if (!handleId || explicitLayers.some((l) => l.inputHandleId === handleId))
				continue;

			const inputItem = inputEntry.value;
			if (!inputItem) continue;

			const type =
				inputItem.type === DataType.Image
					? "Image"
					: inputItem.type === DataType.Text
						? "Text"
						: null;
			if (!type) continue;

			allLayers.push({
				id: handleId,
				inputHandleId: handleId,
				lockAspect: false,
				type,
				x: 0,
				y: 0,
				opacity: 1,
				rotation: 0,
				zIndex: ++maxZ,
				blendMode: "source-over",
				...(type === "Text" ? { ...COMPOSITOR_DEFAULTS, width } : {}),
			});
		}

		// Sort by Z-index for insertion order
		allLayers.sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));

		// 2. Initialize Konva Stage
		// Note: 'container' is ignored in Node.js environment
		const stage = new Konva.Stage({ width, height });
		const konvaLayer = new Konva.Layer();
		stage.add(konvaLayer);

		await setupFonts(allLayers);

		// 3. Render Loop
		for (const layerConfig of allLayers) {
			const input = inputHandlesWithValues.find(
				(f) => f.handle?.id === layerConfig.inputHandleId,
			)?.value;
			if (!input || layerConfig.opacity === 0) continue;

			if (layerConfig.type === "Image" && input.type === DataType.Image) {
				const imgBuffer = await getImageBuffer(input.data as FileData);

				// Load the image using the Node-Canvas utility
				const img = (await loadImage(imgBuffer)) as any;

				const kImage = new Konva.Image({
					// Cast to any to bypass the missing DOM-specific properties
					image: img,
					x: layerConfig.x ?? 0,
					y: layerConfig.y ?? 0,
					width: layerConfig.width ?? img.width,
					height: layerConfig.height ?? img.height,
					opacity: layerConfig.opacity ?? 1,
					rotation: layerConfig.rotation ?? 0,
					stroke: layerConfig.stroke,
					strokeWidth:
						layerConfig.strokeWidth ?? COMPOSITOR_DEFAULTS.STROKE_WIDTH,
					cornerRadius:
						layerConfig.cornerRadius ?? COMPOSITOR_DEFAULTS.CORNER_RADIUS,
					globalCompositeOperation:
						layerConfig.blendMode as GlobalCompositeOperationType,
				});
				konvaLayer.add(kImage);
			} else if (layerConfig.type === "Text" && input.type === DataType.Text) {
				const hasWidth = !!(layerConfig.width && layerConfig.width > 0);

				const kText = new Konva.Text({
					text: String(input.data),
					x: layerConfig.x ?? 0,
					y: layerConfig.y ?? 0,
					width: hasWidth ? layerConfig.width : undefined,
					height: layerConfig.height || undefined,
					fontSize: layerConfig.fontSize ?? COMPOSITOR_DEFAULTS.FONT_SIZE,
					fontFamily: layerConfig.fontFamily ?? COMPOSITOR_DEFAULTS.FONT_FAMILY,
					fontStyle: layerConfig.fontStyle ?? "normal",
					fill: layerConfig.fill ?? COMPOSITOR_DEFAULTS.FILL,
					align: layerConfig.align ?? COMPOSITOR_DEFAULTS.ALIGN,
					verticalAlign:
						layerConfig.verticalAlign ?? COMPOSITOR_DEFAULTS.VERTICAL_ALIGN,
					lineHeight: layerConfig.lineHeight ?? COMPOSITOR_DEFAULTS.LINE_HEIGHT,
					letterSpacing:
						layerConfig.letterSpacing ?? COMPOSITOR_DEFAULTS.LETTER_SPACING,
					textDecoration: layerConfig.textDecoration ?? "",
					wrap: layerConfig.wrap ?? (hasWidth ? "word" : "none"),
					padding: layerConfig.padding ?? COMPOSITOR_DEFAULTS.PADDING,
					stroke: layerConfig.stroke,
					strokeWidth:
						layerConfig.strokeWidth ?? COMPOSITOR_DEFAULTS.STROKE_WIDTH,
					opacity: layerConfig.opacity ?? 1,
					rotation: layerConfig.rotation ?? 0,
					globalCompositeOperation: layerConfig.blendMode as any,
				});
				konvaLayer.add(kText);
			}
		}

		konvaLayer.draw();

		// 4. Persistence
		// Use toCanvas().toBuffer() for higher control or stage.toDataURL()
		const canvasElement = stage.toCanvas();
		const resultBuffer = (canvasElement as any).toBuffer("image/png");

		if (ENV_CONFIG.DEBUG_LOG_MEDIA) logImage(resultBuffer, ".png", node.id);

		const dimensions = getImageDimensions(resultBuffer);
		const key = `${(data.task ?? node).id}/${Date.now()}.png`;
		const { signedUrl, key: tempKey } = await uploadToTemporaryFolder(
			resultBuffer,
			"image/png",
			key,
		);

		const outputHandle = data.handles.find(
			(h) => h.nodeId === node.id && h.type === "Output",
		);
		if (!outputHandle) throw new Error("Output handle missing");

		const newResult: NodeResult = {
			outputs: [
				{
					items: [
						{
							type: DataType.Image,
							data: {
								processData: {
									dataUrl: signedUrl,
									mimeType: "image/png",
									tempKey,
									...dimensions,
								},
							},
							outputHandleId: outputHandle.id,
						},
					],
				},
			],
			selectedOutputIndex: 0,
		};

		// Cleanup
		stage.destroy();

		return { success: true, newResult };
	} catch (err) {
		assertIsError(err);
		return { success: false, error: err.message };
	}
};

export default compositorProcessor;
