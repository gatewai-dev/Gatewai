import * as fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DataType } from "@gatewai/db";
import type {
	CompositorLayer,
	CompositorNodeConfig,
	CompositorResult,
	FileData,
	NodeResult,
} from "@gatewai/types";
import {
	type CanvasRenderingContext2D,
	createCanvas,
	type GlobalCompositeOperation,
	loadImage,
	registerFont,
} from "canvas";
import { ENV_CONFIG } from "../../config.js";
import { logImage } from "../../media-logger.js";
import { getImageBuffer, getImageDimensions } from "../../utils/image.js";
import { uploadToTemporaryFolder } from "../../utils/storage.js";
import { getAllInputValuesWithHandle } from "../resolvers.js";
import type { NodeProcessor } from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- 1. Shared Defaults (Sync with Client) ---
const DEFAULTS = {
	FONT_FAMILY: "Geist",
	FONT_SIZE: 64,
	FILL: "#ffffff",
	LINE_HEIGHT: 1.1,
	ALIGN: "left",
	VERTICAL_ALIGN: "top",
	LETTER_SPACING: 0,
};

const getFontPath = async (fontName: string): Promise<string | null> => {
	try {
		const fontDir = path.join(__dirname, "../../assets/fonts", fontName);
		const files = await fs.readdir(fontDir);
		// Prioritize woff2/woff as they are common web fonts, then ttf/otf
		const fontFile = files.find((f) => /\.(woff2|woff|ttf|otf)$/i.test(f));
		if (!fontFile) return null;
		return path.join(fontDir, fontFile);
	} catch (e) {
		console.warn(`Font not found: ${fontName}`, e);
		return null;
	}
};

const getCompositeOperation = (
	mode: string = "normal",
): GlobalCompositeOperation => {
	const map: Record<string, GlobalCompositeOperation> = {
		"source-over": "source-over",
		normal: "source-over",
		multiply: "multiply",
		screen: "screen",
		overlay: "overlay",
		darken: "darken",
		lighten: "lighten",
		"color-dodge": "color-dodge",
		"color-burn": "color-burn",
		"hard-light": "hard-light",
		"soft-light": "soft-light",
		difference: "difference",
		exclusion: "exclusion",
		hue: "hue",
		saturation: "saturation",
		color: "color",
		luminosity: "luminosity",
	};
	return map[mode] ?? "source-over";
};

/**
 * Text wrapper that respects explicit newlines
 * and performs word-wrapping based on max width.
 */
function getWrappedLines(
	ctx: CanvasRenderingContext2D,
	text: string,
	maxWidth: number,
): string[] {
	// 1. Split by explicit hard returns first to preserve user paragraphs
	const paragraphs = text.split("\n");
	const finalLines: string[] = [];

	for (const paragraph of paragraphs) {
		// If paragraph is empty (double newline), push an empty line
		if (paragraph.length === 0) {
			finalLines.push("");
			continue;
		}

		const words = paragraph.split(" ");
		let currentLine = words[0];

		for (let i = 1; i < words.length; i++) {
			const word = words[i];
			const testLine = `${currentLine} ${word}`;
			const metrics = ctx.measureText(testLine);
			const width = metrics.width;

			if (width < maxWidth) {
				currentLine = testLine;
			} else {
				finalLines.push(currentLine);
				currentLine = word;
			}
		}
		finalLines.push(currentLine);
	}

	return finalLines;
}

const renderTextLayer = (
	ctx: CanvasRenderingContext2D,
	layer: CompositorLayer,
	text: string,
	canvasWidth: number,
) => {
	const fontSize = layer.fontSize ?? DEFAULTS.FONT_SIZE;
	const fontFamily = layer.fontFamily ?? DEFAULTS.FONT_FAMILY;
	const fill = layer.fill ?? DEFAULTS.FILL;
	const align = layer.align ?? DEFAULTS.ALIGN;
	const verticalAlign = layer.verticalAlign ?? DEFAULTS.VERTICAL_ALIGN;
	const letterSpacing = layer.letterSpacing ?? DEFAULTS.LETTER_SPACING;
	const lineHeight = layer.lineHeight ?? DEFAULTS.LINE_HEIGHT;
	const fontStyle = layer.fontStyle ?? "normal";

	// Calculate line height in pixels
	const lineHeightPx = fontSize * lineHeight;

	// Determine constraints
	const maxWidth = layer.width ?? canvasWidth - (layer.x ?? 0);
	const maxHeight = layer.height; // Can be undefined for auto-height

	// 1. Configure Context Typography
	// font string syntax: "style variant weight size/line-height family"
	ctx.font = `${fontStyle} ${fontSize}px "${fontFamily}"`;
	ctx.fillStyle = fill;
	ctx.textBaseline = "top"; // Matches Konva default

	// Polyfill/Type-cast for letterSpacing (Supported in node-canvas >= 2.11.0)
	if ("letterSpacing" in ctx) {
		ctx.letterSpacing = `${letterSpacing}px`;
	}

	// 2. Setup Horizontal Alignment & Anchor Points
	let x = 0;
	if (align === "center") {
		x = maxWidth / 2;
		ctx.textAlign = "center";
	} else if (align === "right") {
		x = maxWidth;
		ctx.textAlign = "right";
	} else {
		x = 0;
		ctx.textAlign = "left";
	}

	// 3. Process Wrapping
	const lines = getWrappedLines(ctx, text, maxWidth);

	// 4. Calculate Vertical Alignment Offset
	let yOffset = 0;
	if (maxHeight !== undefined) {
		// Calculate total height of the text block
		// Note: Konva uses (lines * lineHeightPx) - (lineHeightPx - fontSize) for tight bounds
		// but visual layout usually assumes full line heights steps.
		const totalTextHeight = lines.length * lineHeightPx;

		if (verticalAlign === "middle") {
			yOffset = (maxHeight - totalTextHeight) / 2;
		} else if (verticalAlign === "bottom") {
			yOffset = maxHeight - totalTextHeight;
		}
	}

	// 5. Render
	lines.forEach((line, i) => {
		const y = yOffset + i * lineHeightPx;
		// Clip if it exceeds layer height (optional, Konva clips only if clip:true, but usually text spills)
		// For pixel match, we normally allow spill unless strict bounds are enforced.
		ctx.fillText(line, x, y);

		// Handle Decoration (Underline) - Manual implementation for Canvas
		if (layer.textDecoration === "underline") {
			const metrics = ctx.measureText(line);
			const lineWidth = metrics.width;
			let lineX = x;

			if (align === "center") lineX = x - lineWidth / 2;
			if (align === "right") lineX = x - lineWidth;

			const lineY = y + fontSize; // Approximate baseline for underline
			ctx.fillRect(lineX, lineY, lineWidth, fontSize * 0.08); // simple underline
		}
	});
};

const compositorProcessor: NodeProcessor = async ({ node, data }) => {
	try {
		const config = node.config as CompositorNodeConfig;
		const width = config.width ?? 1080;
		const height = config.height ?? 1080;

		const canvas = createCanvas(width, height);
		const ctx = canvas.getContext("2d");

		// High-quality settings
		ctx.quality = "best";
		ctx.patternQuality = "best";
		ctx.textDrawingMode = "path"; // Ensures cleaner text rendering

		const inputHandlesWithValues = getAllInputValuesWithHandle(data, node.id);
		const explicitLayers = Object.values(config.layerUpdates || {});
		const allLayers: CompositorLayer[] = [...explicitLayers];

		// --- 1. Default Layer Generation (Sync with Index.tsx) ---
		let maxZ = Math.max(...explicitLayers.map((l) => l.zIndex ?? 0), 0);

		for (const inputEntry of inputHandlesWithValues) {
			const handleId = inputEntry.handle?.id;
			if (!handleId) continue;

			// Skip if this handle is already configured in the layers
			if (explicitLayers.some((l) => l.inputHandleId === handleId)) continue;

			const inputItem = inputEntry.value;
			if (!inputItem) continue;

			let type: "Image" | "Text" | undefined;
			if (inputItem.type === DataType.Image) type = "Image";
			else if (inputItem.type === DataType.Text) type = "Text";
			else continue;

			const imgDims: { width?: number; height?: number } = {};
			if (type === "Image") {
				const fData = inputItem.data as FileData;
				// Try to find width/height in standard FileData locations
				const w = fData.entity?.width ?? fData.processData?.width;
				const h = fData.entity?.width ?? fData.processData?.height;
				if (w) imgDims.width = w;
				if (h) imgDims.height = h;
			}

			// Defaults match the Konva initialization in index.tsx
			const defaultLayer: CompositorLayer = {
				id: handleId,
				inputHandleId: handleId,
				type,
				x: 0,
				y: 0,
				opacity: 1,
				rotation: 0,
				lockAspect: true,
				blendMode: "source-over",
				zIndex: ++maxZ,
				...(type === "Text"
					? {
							fontFamily: DEFAULTS.FONT_FAMILY,
							fontSize: DEFAULTS.FONT_SIZE,
							fill: DEFAULTS.FILL,
							letterSpacing: DEFAULTS.LETTER_SPACING,
							lineHeight: DEFAULTS.LINE_HEIGHT,
							align: DEFAULTS.ALIGN,
							verticalAlign: DEFAULTS.VERTICAL_ALIGN,
							width: width, // Default to full width
						}
					: {
							// For Images:
							// If we found dimensions in FileData, use them.
							// If not, leave undefined so render logic uses intrinsic image size.
							width: imgDims.width,
							height: imgDims.height,
						}),
			};

			allLayers.push(defaultLayer);
		}

		// Pre-load custom fonts globally for the canvas environment
		const fontPromises = allLayers
			.filter((l) => l.type === "Text" && l.fontFamily)
			.map(async (l) => {
				if (!l.fontFamily) return;
				const fp = await getFontPath(l.fontFamily);
				if (fp) {
					registerFont(fp, { family: l.fontFamily });
				}
			});
		await Promise.all(fontPromises);

		const sortedLayers = allLayers.sort((a, b) => {
			const aZ = a.zIndex ?? 0;
			const bZ = b.zIndex ?? 0;
			return aZ - bZ;
		});

		for (const layer of sortedLayers) {
			const inputEntry = inputHandlesWithValues.find(
				(f) => f.handle?.id === layer.inputHandleId,
			);

			// If explicit layer exists but no input data, we skip drawing
			if (!inputEntry?.value) continue;
			const inputItem = inputEntry.value;

			// Skip invisible layers
			if (layer.opacity === 0) continue;

			ctx.save();

			const x = Math.round(layer.x ?? 0);
			const y = Math.round(layer.y ?? 0);
			const rotation = (layer.rotation ?? 0) * (Math.PI / 180); // Deg to Rad

			// Apply global transformations
			ctx.translate(x, y);
			ctx.rotate(rotation);

			// Apply Layer Styles
			ctx.globalCompositeOperation = getCompositeOperation(layer.blendMode);
			ctx.globalAlpha = layer.opacity ?? 1;

			if (layer.type === "Image" && inputItem.type === DataType.Image) {
				const fileData = inputItem.data as FileData;
				const imgBuffer = await getImageBuffer(fileData);
				const img = await loadImage(imgBuffer);

				const drawW = layer.width ?? img.width;
				const drawH = layer.height ?? img.height;

				ctx.drawImage(img, 0, 0, drawW, drawH);
			} else if (layer.type === "Text" && inputItem.type === DataType.Text) {
				const textValue = String(inputItem.data);
				renderTextLayer(ctx, layer, textValue, width);
			}

			ctx.restore();
		}

		// --- 5. Output ---
		const resultBuffer = canvas.toBuffer("image/png");

		if (ENV_CONFIG.DEBUG_LOG_MEDIA) {
			logImage(resultBuffer, ".png", node.id);
		}

		const dimensions = getImageDimensions(resultBuffer);
		const key = `${(data.task ?? node).id}/${Date.now()}.png`;
		const mimeType = "image/png";
		console.log({ key });
		const { signedUrl, key: tempKey } = await uploadToTemporaryFolder(
			resultBuffer,
			mimeType,
			key,
		);
		console.log({ tempKey });

		const outputHandle = data.handles.find(
			(h) => h.nodeId === node.id && h.type === "Output",
		);
		if (!outputHandle)
			return { success: false, error: "Output handle is missing." };

		const newResult: NodeResult = structuredClone(
			node.result as NodeResult,
		) ?? {
			outputs: [],
			selectedOutputIndex: 0,
		};

		const newGeneration: CompositorResult["outputs"][number] = {
			items: [
				{
					type: DataType.Image,
					data: {
						processData: {
							dataUrl: signedUrl,
							mimeType,
							tempKey,
							...dimensions,
						},
					},
					outputHandleId: outputHandle.id,
				},
			],
		};

		newResult.outputs = [newGeneration];
		newResult.selectedOutputIndex = newResult.outputs.length - 1;

		return { success: true, newResult };
	} catch (err: unknown) {
		console.error("Compositor Processor Error:", err);
		return {
			success: false,
			error:
				err instanceof Error ? err.message : "Compositor processing failed",
		};
	}
};

export default compositorProcessor;
