import fs from "fs/promises";
import path from "path";
import sharp from "sharp";

interface TextLayerConfig {
	id: string;
	type: "Text" | "Image";
	inputHandleId: string;
	x?: number;
	y?: number;
	width?: number;
	height?: number;
	scaleX?: number;
	scaleY?: number;
	rotation?: number;
	fontSize?: number;
	lineHeight?: number;
	fontFamily?: string;
	letterSpacing?: number;
	align?: "left" | "center" | "right";
	fill?: string;
	blendMode?: string;
}

interface CompositorNodeConfig {
	width?: number;
	height?: number;
	layerUpdates?: Record<string, TextLayerConfig>;
}

class SharpCompositor {
	private fontCache: Map<string, string> = new Map();

	/**
	 * Load a font file and return base64 data URL
	 */
	async loadFont(fontPath: string, fontFamily: string): Promise<string> {
		if (this.fontCache.has(fontFamily)) {
			return this.fontCache.get(fontFamily) as string;
		}

		try {
			const fontBuffer = await fs.readFile(fontPath);
			const base64 = fontBuffer.toString("base64");
			const ext = path.extname(fontPath).toLowerCase();

			let format = "truetype";
			if (ext === ".woff") format = "woff";
			else if (ext === ".woff2") format = "woff2";
			else if (ext === ".otf") format = "opentype";

			const dataUrl = `data:font/${format};base64,${base64}`;
			this.fontCache.set(fontFamily, dataUrl);

			return dataUrl;
		} catch (error) {
			console.warn(`Failed to load font ${fontPath}:`, error);
			return "";
		}
	}

	/**
	 * Create SVG text element with proper styling and transforms
	 */
	private createTextSVG(
		text: string,
		layer: TextLayerConfig,
		fontDataUrl?: string,
	): string {
		const fontSize = layer.fontSize ?? 24;
		const lineHeight = layer.lineHeight ?? 1;
		const fill = layer.fill ?? "#ffffff";
		const fontFamily = layer.fontFamily ?? "sans-serif";
		const letterSpacing = layer.letterSpacing ?? 0;
		const align = layer.align ?? "left";

		// Calculate text anchor based on alignment
		const textAnchor =
			align === "center" ? "middle" : align === "right" ? "end" : "start";

		// Word wrap handling
		const maxWidth = layer.width || 800;
		const lines = this.wrapText(text, maxWidth, fontSize, fontFamily);

		// Calculate SVG dimensions
		const svgHeight = lines.length * fontSize * lineHeight + fontSize;
		const svgWidth = maxWidth;

		// Build font-face if custom font is provided
		const fontFace = fontDataUrl
			? `<defs>
          <style>
            @font-face {
              font-family: '${fontFamily}';
              src: url('${fontDataUrl}');
            }
          </style>
        </defs>`
			: "";

		// Build text elements for each line
		const textElements = lines
			.map((line, i) => {
				const y = fontSize + i * fontSize * lineHeight;
				const x =
					align === "center" ? svgWidth / 2 : align === "right" ? svgWidth : 0;

				return `<text x="${x}" y="${y}" 
                  font-family="${fontFamily}" 
                  font-size="${fontSize}" 
                  fill="${fill}"
                  letter-spacing="${letterSpacing}"
                  text-anchor="${textAnchor}">${this.escapeXml(line)}</text>`;
			})
			.join("\n");

		return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${svgWidth}" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg">
  ${fontFace}
  ${textElements}
</svg>`;
	}

	/**
	 * Simple word wrap algorithm
	 */
	private wrapText(
		text: string,
		maxWidth: number,
		fontSize: number,
		fontFamily: string,
	): string[] {
		// Rough estimation: ~0.5 * fontSize per character for most fonts
		const avgCharWidth = fontSize * 0.5;
		const maxCharsPerLine = Math.floor(maxWidth / avgCharWidth);

		const words = text.split(/\s+/);
		const lines: string[] = [];
		let currentLine = "";

		for (const word of words) {
			const testLine = currentLine ? `${currentLine} ${word}` : word;

			if (testLine.length * avgCharWidth <= maxWidth || !currentLine) {
				currentLine = testLine;
			} else {
				lines.push(currentLine);
				currentLine = word;
			}
		}

		if (currentLine) {
			lines.push(currentLine);
		}

		return lines.length ? lines : [""];
	}

	/**
	 * Escape XML special characters
	 */
	private escapeXml(text: string): string {
		return text
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&apos;");
	}

	/**
	 * Convert blend mode to Sharp blend mode
	 */
	private getSharpBlendMode(blendMode: string): sharp.Blend {
		const blendMap: Record<string, sharp.Blend> = {
			normal: "over",
			multiply: "multiply",
			screen: "screen",
			overlay: "overlay",
			add: "add",
		};
		return (blendMap[blendMode] || "over") as sharp.Blend;
	}

	/**
	 * Main compositor function similar to PixiJS implementation
	 */
	async processCompositor(
		config: CompositorNodeConfig,
		inputs: Map<string, { type: "Image" | "Text"; value: string }>,
		fontPaths?: Map<string, string>, // Map of fontFamily -> font file path
		signal?: AbortSignal,
	): Promise<{ dataUrl: string; width: number; height: number }> {
		const width = config.width || 1024;
		const height = config.height || 1024;

		// Create base canvas
		let canvas = sharp({
			create: {
				width,
				height,
				channels: 4,
				background: { r: 0, g: 0, b: 0, alpha: 0 },
			},
		});

		const composites: sharp.OverlayOptions[] = [];
		const layers = Object.values(config.layerUpdates || {});

		// Sort layers by z-index if available
		// layers.sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));

		for (const layer of layers) {
			if (signal?.aborted) {
				throw new DOMException("Cancelled", "AbortError");
			}

			const inputData = inputs.get(layer.inputHandleId);
			if (!inputData) continue;

			let inputBuffer: Buffer | null = null;

			if (layer.type === "Image" && inputData.type === "Image") {
				try {
					// Load image from URL or file path or data URL
					if (inputData.value.startsWith("data:")) {
						const base64Data = inputData.value.split(",")[1];
						inputBuffer = Buffer.from(base64Data, "base64");
					} else if (inputData.value.startsWith("http")) {
						const response = await fetch(inputData.value);
						inputBuffer = Buffer.from(await response.arrayBuffer());
					} else {
						inputBuffer = await fs.readFile(inputData.value);
					}

					// Resize if dimensions specified
					let imageSharp = sharp(inputBuffer);
					if (layer.width || layer.height) {
						imageSharp = imageSharp.resize(layer.width, layer.height, {
							fit: "fill",
						});
					}

					inputBuffer = await imageSharp.png().toBuffer();
				} catch (e) {
					console.warn(`Load failed: ${layer.id}`, e);
					continue;
				}
			} else if (layer.type === "Text" && inputData.type === "Text") {
				try {
					// Load custom font if provided
					let fontDataUrl: string | undefined;
					if (layer.fontFamily && fontPaths?.has(layer.fontFamily)) {
						fontDataUrl = await this.loadFont(
							fontPaths.get(layer.fontFamily)!,
							layer.fontFamily,
						);
					}

					// Create SVG text
					const svg = this.createTextSVG(inputData.value, layer, fontDataUrl);

					// Convert SVG to PNG buffer
					inputBuffer = await sharp(Buffer.from(svg)).png().toBuffer();
				} catch (e) {
					console.warn(`Text render failed: ${layer.id}`, e);
					continue;
				}
			}

			if (inputBuffer) {
				// Apply transforms
				const scaleX = layer.scaleX ?? 1;
				const scaleY = layer.scaleY ?? 1;
				const rotation = layer.rotation ?? 0;

				// Apply scaling and rotation if needed
				if (scaleX !== 1 || scaleY !== 1 || rotation !== 0) {
					const metadata = await sharp(inputBuffer).metadata();
					const w = metadata.width!;
					const h = metadata.height!;

					// Calculate new dimensions after rotation
					const rad = (rotation * Math.PI) / 180;
					const cos = Math.abs(Math.cos(rad));
					const sin = Math.abs(Math.sin(rad));
					const newW = Math.ceil(w * cos + h * sin);
					const newH = Math.ceil(w * sin + h * cos);

					inputBuffer = await sharp(inputBuffer)
						.resize(Math.round(w * scaleX), Math.round(h * scaleY))
						.rotate(rotation, { background: { r: 0, g: 0, b: 0, alpha: 0 } })
						.toBuffer();
				}

				composites.push({
					input: inputBuffer,
					top: Math.round(layer.y ?? 0),
					left: Math.round(layer.x ?? 0),
					blend: this.getSharpBlendMode(layer.blendMode || "normal"),
				});
			}
		}

		if (signal?.aborted) {
			throw new DOMException("Cancelled", "AbortError");
		}

		// Composite all layers
		if (composites.length > 0) {
			canvas = canvas.composite(composites);
		}

		// Render to buffer
		const outputBuffer = await canvas.png().toBuffer();

		if (signal?.aborted) {
			throw new DOMException("Cancelled", "AbortError");
		}

		// Convert to data URL
		const dataUrl = `data:image/png;base64,${outputBuffer.toString("base64")}`;

		return { dataUrl, width, height };
	}
}

// Example usage
async function example() {
	const compositor = new SharpCompositor();

	const config: CompositorNodeConfig = {
		width: 1024,
		height: 1024,
		layerUpdates: {
			layer1: {
				id: "layer1",
				type: "Text",
				inputHandleId: "text1",
				x: 100,
				y: 100,
				width: 800,
				fontSize: 48,
				fontFamily: "CustomFont",
				fill: "#ffffff",
				align: "center",
				lineHeight: 1.5,
			},
		},
	};

	const inputs = new Map([
		[
			"text1",
			{
				type: "Text" as const,
				value: "Hello World! This is a long text that will wrap.",
			},
		],
	]);

	// Optional: Provide custom font paths
	const fontPaths = new Map([["CustomFont", "./fonts/MyFont.ttf"]]);

	const result = await compositor.processCompositor(config, inputs, fontPaths);

	console.log("Rendered:", result.width, "x", result.height);

	// Save to file
	const base64Data = result.dataUrl.split(",")[1];
	await fs.writeFile("output.png", Buffer.from(base64Data, "base64"));
}

export { SharpCompositor };
