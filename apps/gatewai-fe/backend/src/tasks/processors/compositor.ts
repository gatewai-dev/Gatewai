import * as fs from "node:fs/promises";
import { readFile } from "node:fs/promises";
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
import sharp, { type Blend, type OverlayOptions } from "sharp";
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

const getFontPath = async (fontName: string) => {
	const fontDir = path.join(__dirname, "../../assets/fonts", fontName);
	const files = await fs.readdir(fontDir);
	const fontFile = files.find(
		(f) =>
			f.endsWith(".woff") ||
			f.endsWith(".woff2") ||
			f.endsWith(".ttf") ||
			f.endsWith(".otf"),
	);
	if (!fontFile) {
		throw new Error(`Font file not found ${fontName}`);
	}
	return path.join(fontDir, fontFile);
};

// Map Pixi/CSS blend modes to Sharp/Libvips blend modes
const getBlendMode = (mode: string = "normal"): Blend => {
	const map: Record<string, Blend> = {
		normal: "over",
		multiply: "multiply",
		screen: "screen",
		overlay: "overlay",
		darken: "darken",
		lighten: "lighten",
		"color-dodge": "colour-dodge",
		"color-burn": "colour-burn",
		"hard-light": "hard-light",
		"soft-light": "soft-light",
		difference: "difference",
		exclusion: "exclusion",
		// Fallbacks for modes not directly supported by composite ops
		saturation: "over",
		color: "over",
		luminosity: "over",
	};
	return map[mode] ?? "over";
};

// Helper: Load font file and convert to Base64 for SVG embedding
async function getFontBase64(fontFamily: string): Promise<string | null> {
	try {
		const path = await getFontPath(fontFamily);
		if (!path) return null;

		const buffer = await readFile(path);

		return `data:font/${path.split(".").pop() ?? "ttf"};charset=utf-8;base64,${buffer.toString("base64")}`;
	} catch (e) {
		console.warn(`Failed to load font ${fontFamily}`, e);
		return null;
	}
}

// Helper: Generate SVG for Text Layer
async function generateTextSvg(
	layer: CompositorLayer,
	text: string,
): Promise<Buffer> {
	const fontSize = layer.fontSize ?? 24;
	const fontFamily = layer.fontFamily ?? "sans-serif";
	const fill = layer.fill ?? "#ffffff";
	const width = layer.width ? `width="${layer.width}"` : "";
	const fontWeight = "normal"; // Defaulting as layer config usually specifies family directly

	// Try to load custom font
	const fontBase64 = layer.fontFamily
		? await getFontBase64(layer.fontFamily)
		: null;

	const fontFace = fontBase64
		? `@font-face { font-family: "${fontFamily}"; src: url("${fontBase64}"); }`
		: "";

	// Simple heuristic for word wrapping if width is set (SVG <text> doesn't auto-wrap easily)
	// This is an approximation. For exact parity, more complex measurement is needed.
	let content = text;
	if (layer.width) {
		const avgCharWidth = fontSize * 0.6;
		const charsPerLine = Math.floor(layer.width / avgCharWidth);
		const words = text.split(" ");
		const lines: string[] = [];
		let currentLine = words[0];

		for (let i = 1; i < words.length; i++) {
			if (currentLine.length + 1 + words[i].length < charsPerLine) {
				currentLine += ` ${words[i]}`;
			} else {
				lines.push(currentLine);
				currentLine = words[i];
			}
		}
		lines.push(currentLine);

		// Convert to tspan
		const lineHeight = (layer.lineHeight ?? 1) * fontSize;
		content = lines
			.map(
				(line, i) =>
					`<tspan x="0" dy="${i === 0 ? fontSize : lineHeight}">${line}</tspan>`,
			)
			.join("");
	} else {
		// Single line, ensure baseline is correct
		content = `<tspan x="0" dy="${fontSize}">${text}</tspan>`;
	}

	const svg = `
	<svg width="${layer.width || 1024}" height="${layer.height || 1024}" xmlns="http://www.w3.org/2000/svg">
		<defs>
			<style>
				${fontFace}
				.text-style {
					font-family: "${fontFamily}", sans-serif;
					font-size: ${fontSize}px;
					fill: ${fill};
					text-anchor: ${layer.align === "center" ? "middle" : layer.align === "right" ? "end" : "start"};
				}
			</style>
		</defs>
		<text x="${layer.align === "center" ? "50%" : layer.align === "right" ? "100%" : "0"}" y="0" class="text-style">${content}</text>
	</svg>
	`;

	return Buffer.from(svg);
}

const compositorProcessor: NodeProcessor = async ({ node, data }) => {
	try {
		const config = node.config as CompositorNodeConfig;
		const width = config.width ?? 1024;
		const height = config.height ?? 1024;

		const inputHandlesWithValues = getAllInputValuesWithHandle(data, node.id);
		// Initialize Stage (Background)
		// We start with a transparent background of the target size
		const baseComposite = sharp({
			create: {
				width,
				height,
				channels: 4,
				background: { r: 0, g: 0, b: 0, alpha: 0 },
			},
		});

		const layers = Object.values(config.layerUpdates || {});
		const compositeOps: OverlayOptions[] = [];

		// 2. Process Layers
		for (const layer of layers) {
			const inputHandleId = layer.inputHandleId;

			// Resolve Input Data manually from the execution context inputs
			// We look for the specific input handle ID in the supplied data inputs
			const inputEntry = inputHandlesWithValues.find(
				(f) => f.handle?.id === inputHandleId,
			);

			if (!inputEntry) continue;
			const inputItem = inputEntry.value; // Value from Map

			let layerBuffer: Buffer | null = null;
			let layerTop = Math.round(layer.y || 0);
			let layerLeft = Math.round(layer.x || 0);

			if (layer.type === "Image" && inputItem?.type === DataType.Image) {
				const fileData = inputItem.data as FileData;
				const originalBuffer = await getImageBuffer(fileData);

				let pipeline = sharp(originalBuffer);

				// Resize (Scale)
				// If specific width/height set, force resize. Otherwise scale.
				if (layer.width && layer.height) {
					pipeline = pipeline.resize(
						Math.round(layer.width),
						Math.round(layer.height),
						{ fit: "fill" },
					);
				} else if (layer.scaleX || layer.scaleY) {
					// We need metadata to scale proportionally
					const meta = await pipeline.metadata();
					const newW = Math.round((meta.width ?? 100) * (layer.scaleX ?? 1));
					const newH = Math.round((meta.height ?? 100) * (layer.scaleY ?? 1));
					pipeline = pipeline.resize(newW, newH, { fit: "fill" });
				}

				if (layer.rotation) {
					pipeline = pipeline.rotate(layer.rotation, {
						background: { r: 0, g: 0, b: 0, alpha: 0 },
					});
				}

				layerBuffer = await pipeline.toBuffer();
			} else if (layer.type === "Text" && inputItem?.type === DataType.Text) {
				const textValue = String(inputItem.data);
				layerBuffer = await generateTextSvg(layer, textValue);

				// Apply rotation to the generated SVG if needed
				if (layer.rotation) {
					layerBuffer = await sharp(layerBuffer)
						.rotate(layer.rotation, {
							background: { r: 0, g: 0, b: 0, alpha: 0 },
						})
						.toBuffer();
				}
			}

			if (layerBuffer) {
				// Get layer dimensions
				const metadata = await sharp(layerBuffer).metadata();
				const layerW = metadata.width ?? 0;
				const layerH = metadata.height ?? 0;

				// Calculate crop offsets and visible dimensions to mask within canvas
				const cropX = Math.max(0, -layerLeft);
				const cropY = Math.max(0, -layerTop);
				const visibleW = Math.min(
					layerW - cropX,
					width - Math.max(0, layerLeft),
				);
				const visibleH = Math.min(
					layerH - cropY,
					height - Math.max(0, layerTop),
				);

				if (visibleW <= 0 || visibleH <= 0) continue;

				// Crop the layer buffer to the visible part
				layerBuffer = await sharp(layerBuffer)
					.extract({
						left: cropX,
						top: cropY,
						width: visibleW,
						height: visibleH,
					})
					.toBuffer();

				// Adjust position to be within canvas
				layerLeft = Math.max(0, layerLeft);
				layerTop = Math.max(0, layerTop);

				compositeOps.push({
					input: layerBuffer,
					top: layerTop,
					left: layerLeft,
					blend: getBlendMode(layer.blendMode),
				});
			}
		}

		// Composite All Layers
		const resultBuffer = await baseComposite
			.composite(compositeOps)
			.png()
			.toBuffer();
		logMedia(resultBuffer, undefined, node.id);
		// Construct Result
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

		newResult.outputs = [newGeneration]; // Replace or push depending on logic, usually replace for compositor
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
