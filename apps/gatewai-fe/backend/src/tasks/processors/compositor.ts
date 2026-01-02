import * as fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DataType } from "@gatewai/db";
import type {
	CompositorLayer,
	CompositorNodeConfig,
	FileData,
	NodeResult,
	Output,
} from "@gatewai/types";
import {
	type CanvasRenderingContext2D,
	createCanvas,
	type GlobalCompositeOperation,
	loadImage,
	registerFont,
} from "canvas";
import { logMedia } from "../../media-logger.js";
import {
	bufferToDataUrl,
	getImageBuffer,
	getImageDimensions,
} from "../../utils/image.js";
import { getAllInputValuesWithHandle } from "../resolvers.js";
import type { NodeProcessor } from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const getFontPath = async (fontName: string): Promise<string | null> => {
	try {
		const fontDir = path.join(__dirname, "../../assets/fonts", fontName);
		const files = await fs.readdir(fontDir);
		const fontFile = files.find((f) => /\.(woff|woff2|ttf|otf)$/i.test(f));
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

// --- Text Layout Logic ---

/**
 * Wraps text into lines based on max width.
 * Mimics standard Pixi/CSS word-wrap behavior.
 */
function wrapText(
	ctx: CanvasRenderingContext2D,
	text: string,
	maxWidth: number,
): string[] {
	const words = text.split(" ");
	const lines: string[] = [];
	let currentLine = words[0];

	for (let i = 1; i < words.length; i++) {
		const word = words[i];
		const width = ctx.measureText(`${currentLine} ${word}`).width;
		if (width < maxWidth) {
			currentLine += ` ${word}`;
		} else {
			lines.push(currentLine);
			currentLine = word;
		}
	}
	lines.push(currentLine);
	return lines;
}

const renderTextLayer = (
	ctx: CanvasRenderingContext2D,
	layer: CompositorLayer,
	text: string,
) => {
	const fontSize = layer.fontSize ?? 24;
	const fontFamily = layer.fontFamily ?? "Geist";
	const fill = layer.fill ?? "#ffffff";
	const align = layer.align ?? "left";
	const lineHeight = (layer.lineHeight ?? 1) * fontSize;
	const maxWidth = layer.width ?? 0;

	// 1. Configure Context
	// We strictly quote the font family to handle names with spaces
	ctx.font = `${fontSize}px "${fontFamily}"`;
	ctx.fillStyle = fill;
	ctx.textBaseline = "top";

	// 2. Handle Text Wrapping
	let lines: string[] = [text];
	if (maxWidth > 0) {
		lines = wrapText(ctx, text, maxWidth);
	}

	// 3. Draw Lines
	// We draw relative to (0,0) because the context is already transformed (translated/rotated)
	lines.forEach((line, i) => {
		const y = i * lineHeight;
		let x = 0;

		// Calculate alignment offset
		if (maxWidth > 0) {
			const lineWidth = ctx.measureText(line).width;
			if (align === "center") {
				x = (maxWidth - lineWidth) / 2;
			} else if (align === "right") {
				x = maxWidth - lineWidth;
			}
		} else {
			// If no width constraint, simple alignment
			if (align === "center") ctx.textAlign = "center";
			else if (align === "right") ctx.textAlign = "right";
			else ctx.textAlign = "left";
		}

		ctx.fillText(line, x, y);
	});
};

const compositorProcessor: NodeProcessor = async ({ node, data }) => {
	try {
		const config = node.config as CompositorNodeConfig;
		const width = config.width ?? 1024;
		const height = config.height ?? 1024;

		// 1. Initialize Canvas
		const canvas = createCanvas(width, height);
		const ctx = canvas.getContext("2d");

		// 2. Resolve Inputs & Register Fonts
		const inputHandlesWithValues = getAllInputValuesWithHandle(data, node.id);
		const layers = Object.values(config.layerUpdates || {});

		// Pre-load custom fonts globally for the canvas environment
		const fontPromises = layers
			.filter((l) => l.type === "Text" && l.fontFamily)
			.map(async (l) => {
				if (!l.fontFamily) return;
				const fp = await getFontPath(l.fontFamily);
				if (fp) {
					registerFont(fp, { family: l.fontFamily });
				}
			});
		await Promise.all(fontPromises);

		// Render Loop
		// Sort layers if order property exists, otherwise rely on object order (which is usually insertion order)
		// Ensure strictly sorted by explicit z-index if available, or index.
		// Assuming config.layerUpdates keys or array order dictates z-index.

		for (const handleValue of inputHandlesWithValues) {
			const layer = layers.find(
				(f) => f.inputHandleId === handleValue?.handle?.id,
			);
			if (!layer) continue;
			const inputHandleId = layer.inputHandleId;
			const inputEntry = inputHandlesWithValues.find(
				(f) => f.handle?.id === inputHandleId,
			);

			// Skip if no input, unless it's a pure decoration layer (logic depends on your app)
			if (!inputEntry) continue;
			const inputItem = inputEntry.value;

			ctx.save();

			const x = Math.round(layer.x ?? 0);
			const y = Math.round(layer.y ?? 0);
			const rotation = (layer.rotation ?? 0) * (Math.PI / 180); // Deg to Rad

			// Move to layer origin
			ctx.translate(x, y);
			ctx.rotate(rotation);

			// --- B. Blending ---
			ctx.globalCompositeOperation = getCompositeOperation(layer.blendMode);
			ctx.globalAlpha = 1;

			// --- C. Draw Content ---
			if (layer.type === "Image" && inputItem?.type === DataType.Image) {
				const fileData = inputItem.data as FileData;
				const imgBuffer = await getImageBuffer(fileData);
				const img = await loadImage(imgBuffer);

				// Determine final draw dimensions
				const drawW = layer.width ?? img.width * (layer.scaleX ?? 1);
				const drawH = layer.height ?? img.height * (layer.scaleY ?? 1);
				ctx.drawImage(img, 0, 0, drawW, drawH);
			} else if (layer.type === "Text" && inputItem?.type === DataType.Text) {
				const textValue = String(inputItem.data);
				renderTextLayer(ctx, layer, textValue);
			}

			ctx.restore();
		}

		// 4. Output Generation
		const resultBuffer = canvas.toBuffer("image/png");
		logMedia(resultBuffer, undefined, node.id);

		const dimensions = getImageDimensions(resultBuffer);
		const dataUrl = bufferToDataUrl(resultBuffer, "image/png");

		const outputHandle = data.handles.find(
			(h) => h.nodeId === node.id && h.type === "Output",
		);
		if (!outputHandle) throw new Error("Output handle is missing");

		const newResult: NodeResult = structuredClone(
			node.result as NodeResult,
		) ?? {
			outputs: [],
			selectedOutputIndex: 0,
		};

		const newGeneration: Output = {
			items: [
				{
					type: DataType.Image,
					data: { processData: { dataUrl, ...dimensions } },
					outputHandleId: outputHandle.id,
				},
			],
		};

		newResult.outputs = [newGeneration];
		newResult.selectedOutputIndex = 0;

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
