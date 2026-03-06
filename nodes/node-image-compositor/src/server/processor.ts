import * as fs from "node:fs/promises";
import path from "node:path";
import { TOKENS } from "@gatewai/core/di";
import {
	COMPOSITOR_DEFAULTS,
	type FileData,
	type GraphResolvers,
	type MediaService,
	type NodeProcessor,
	type NodeResult,
} from "@gatewai/core/types";
import { DataType } from "@gatewai/db";
import type {
	BackendNodeProcessorCtx,
	BackendNodeProcessorResult,
	StorageService,
} from "@gatewai/node-sdk/server";
import { loadImage, registerFont } from "canvas";
import { inject, injectable } from "inversify";
import Konva from "konva";
import type { CompositorResult } from "../shared/index.js";
import "konva/canvas-backend";
import type { CompositorLayer, CompositorNodeConfig } from "../shared/config.js";

// ─── Type helpers ─────────────────────────────────────────────────────────────

const RASTER_DATA_TYPES = new Set<DataType>([DataType.Image, DataType.SVG]);

const isRasterDataType = (type: DataType): boolean =>
	RASTER_DATA_TYPES.has(type);

const dataTypeToLayerType = (
	type: DataType,
): "Image" | "SVG" | "Text" | null => {
	if (type === DataType.Image) return "Image";
	if (type === DataType.SVG) return "SVG";
	if (type === DataType.Text) return "Text";
	return null;
};

// ─── Raster rendering helper ──────────────────────────────────────────────────

/**
 * Loads a raster buffer (Image or SVG) into a Konva.Image node.
 * node-canvas's `loadImage` supports both raster images and SVG documents,
 * so Image and SVG are handled by the same pipeline on the server side too.
 */
const buildRasterKonvaNode = async (
	buffer: Buffer,
	layerConfig: CompositorLayer,
): Promise<Konva.Image> => {
	const img = (await loadImage(buffer)) as any;
	return new Konva.Image({
		image: img,
		x: layerConfig.x ?? 0,
		y: layerConfig.y ?? 0,
		width: layerConfig.width ?? img.width,
		height: layerConfig.height ?? img.height,
		opacity: layerConfig.opacity ?? 1,
		rotation: layerConfig.rotation ?? 0,
		stroke: layerConfig.stroke,
		strokeWidth: layerConfig.strokeWidth ?? COMPOSITOR_DEFAULTS.STROKE_WIDTH,
		cornerRadius:
			layerConfig.cornerRadius ?? COMPOSITOR_DEFAULTS.CORNER_RADIUS,
		globalCompositeOperation:
			layerConfig.blendMode as GlobalCompositeOperation,
	});
};

// ─────────────────────────────────────────────────────────────────────────────

@injectable()
export class ImageCompositorProcessor implements NodeProcessor {
	constructor(
		@inject(TOKENS.STORAGE) private storage: StorageService,
		@inject(TOKENS.MEDIA) private media: MediaService,
		@inject(TOKENS.GRAPH_RESOLVERS) private graph: GraphResolvers,
	) { }

	async process({
		node,
		data,
	}: BackendNodeProcessorCtx): Promise<BackendNodeProcessorResult<CompositorResult>> {
		try {
			const config = node.config as CompositorNodeConfig;
			const width = config.width ?? 1080;
			const height = config.height ?? 1080;

			// 1. Unify Layers (Explicit from config + Implicit from inputs)
			const inputHandlesWithValues = this.graph.getAllInputValuesWithHandle(
				data,
				node.id,
			);
			const explicitLayers = Object.values(config.layerUpdates || {});
			let maxZ = Math.max(...explicitLayers.map((l) => l.zIndex ?? 0), 0);

			const allLayers: CompositorLayer[] = [...explicitLayers];

			for (const inputEntry of inputHandlesWithValues) {
				const handleId = inputEntry.handle?.id;
				if (
					!handleId ||
					explicitLayers.some((l) => l.inputHandleId === handleId)
				)
					continue;

				const inputItem = inputEntry.value;
				if (!inputItem) continue;

				const type = dataTypeToLayerType(inputItem.type);
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
					...(type === "Text" ? { ...COMPOSITOR_DEFAULTS } : {}),
				});
			}

			allLayers.sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));

			// 2. Initialize Konva Stage
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

				if (isRasterDataType(input.type)) {
					const imgBuffer = await this.media.getImageBuffer(
						input.data as FileData,
					);
					const kImage = await buildRasterKonvaNode(imgBuffer, layerConfig);
					konvaLayer.add(kImage);
				} else if (input.type === DataType.Text) {
					const hasWidth = !!(layerConfig.width && layerConfig.width > 0);
					const kText = new Konva.Text({
						text: String(input.data),
						x: layerConfig.x ?? 0,
						y: layerConfig.y ?? 0,
						width: hasWidth ? layerConfig.width : undefined,
						height: layerConfig.height || undefined,
						fontSize: layerConfig.fontSize ?? COMPOSITOR_DEFAULTS.FONT_SIZE,
						fontFamily:
							layerConfig.fontFamily ?? COMPOSITOR_DEFAULTS.FONT_FAMILY,
						fontStyle: `${layerConfig.fontWeight ?? "normal"} ${layerConfig.fontStyle ?? "normal"}`,
						fill: layerConfig.fill ?? COMPOSITOR_DEFAULTS.FILL,
						align: layerConfig.align ?? COMPOSITOR_DEFAULTS.ALIGN,
						verticalAlign:
							layerConfig.verticalAlign ?? COMPOSITOR_DEFAULTS.VERTICAL_ALIGN,
						lineHeight:
							layerConfig.lineHeight ?? COMPOSITOR_DEFAULTS.LINE_HEIGHT,
						letterSpacing:
							layerConfig.letterSpacing ?? COMPOSITOR_DEFAULTS.LETTER_SPACING,
						textDecoration: layerConfig.textDecoration ?? "",
						padding: layerConfig.padding ?? COMPOSITOR_DEFAULTS.PADDING,
						stroke: layerConfig.stroke,
						strokeWidth:
							layerConfig.strokeWidth ?? COMPOSITOR_DEFAULTS.STROKE_WIDTH,
						opacity: layerConfig.opacity ?? 1,
						rotation: layerConfig.rotation ?? 0,
						globalCompositeOperation: layerConfig.blendMode,
					});
					konvaLayer.add(kText);
				}
			}

			konvaLayer.draw();

			// 4. Persistence
			const canvasElement = stage.toCanvas();
			// biome-ignore lint/suspicious/noExplicitAny: Invalid base type
			const resultBuffer = (canvasElement as any).toBuffer("image/png");

			const dimensions = this.media.getImageDimensions(resultBuffer);
			const key = `${(data.task ?? node).id}/${Date.now()}.png`;
			const { signedUrl, key: tempKey } =
				await this.storage.uploadToTemporaryStorageFolder(
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

			stage.destroy();

			return {
				success: true,
				newResult: newResult as unknown as CompositorResult,
			};
		} catch (err) {
			return {
				success: false,
				error: err instanceof Error ? err.message : "Unknown error",
			};
		}
	}
}

/**
 * Resolves local font files and registers them with the canvas backend.
 * Only Text layers require fonts; raster layers (Image, SVG) are skipped.
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