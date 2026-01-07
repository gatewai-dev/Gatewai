import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type {
	FileData,
	VideoCompositorLayer,
	VideoCompositorNodeConfig,
} from "@gatewai/types";
import { bundle } from "@remotion/bundler";
import {
	type CancelSignal,
	renderMedia,
	selectComposition,
} from "@remotion/renderer";
import type { NodeProcessorParams } from "./types";

export class RemotionNodeProcessorService {
	private serveUrl: string | null = null;

	constructor(private entryPoint: string) {}

	private async init() {
		if (!this.serveUrl) {
			this.serveUrl = await bundle(this.entryPoint);
		}
	}

	async processVideo(
		config: VideoCompositorNodeConfig,
		inputDataMap: NodeProcessorParams["inputs"],
		signal?: CancelSignal,
	): Promise<{ dataUrl: string; width: number; height: number }> {
		await this.init();

		if (!this.serveUrl) {
			throw new Error("Serve URL is missing.");
		}

		const fps = config.FPS ?? 24;

		const layers = Object.values(
			config.layerUpdates ?? {},
		) as VideoCompositorLayer[];
		const mediaDurationPromises: Promise<any>[] = [];

		for (const layer of layers) {
			const input = inputDataMap[layer.inputHandleId];
			if (!input) continue;

			if (layer.durationInFrames == null) {
				if (
					input.outputItem?.type === "Video" ||
					input.outputItem?.type === "Audio"
				) {
					const promise = getMediaDuration(
						input.outputItem.data as FileData,
						input.outputItem.type as "Video" | "Audio",
					).then((durSec) => {
						layer.durationInFrames = Math.floor(durSec * fps);
					});
					mediaDurationPromises.push(promise);
				} else {
					layer.durationInFrames = 150; // Default ~5s at 30fps if unknown
				}
			}
		}

		await Promise.all(mediaDurationPromises);

		const uniqueFonts = new Set<string>();
		for (const layer of layers) {
			const input = inputDataMap[layer.inputHandleId];
			if (input?.outputItem?.type === "Text" && layer.fontFamily) {
				uniqueFonts.add(layer.fontFamily);
			}
		}

		const fontUrls: Record<string, string> = {};
		const fontPromises = Array.from(uniqueFonts).map(async (fontFamily) => {
			const folderName = fontFamily.replace(/\s+/g, "_");
			const fontDir = path.join(__dirname, "..", "assets", "fonts", folderName);
			const files = await fsp.readdir(fontDir);
			const extensions = [".woff2", ".woff", ".ttf", ".otf"];
			const fontFile = files.find((f) =>
				extensions.some((ext) => f.endsWith(ext)),
			);
			if (!fontFile) {
				throw new Error(`Font file not found for ${fontFamily}`);
			}
			const fullPath = path.join(fontDir, fontFile);
			fontUrls[fontFamily] = `file://${fullPath}`;
		});

		await Promise.all(fontPromises);

		const inputProps = { config, inputDataMap, fontUrls };
		const now = Date.now();
		const composition = await selectComposition({
			serveUrl: this.serveUrl,
			id: `dynamic-video-${now}`,
			inputProps,
		});

		const tempDir = os.tmpdir();
		const outputLocation = path.join(tempDir, `remotion-output-${now}.mp4`);

		await renderMedia({
			codec: "h264",
			serveUrl: this.serveUrl,
			composition,
			outputLocation,
			inputProps,
			cancelSignal: signal,
		});

		const buffer = fs.readFileSync(outputLocation);
		fs.unlinkSync(outputLocation); // Clean up temp file

		const dataUrl = `data:video/mp4;base64,${buffer.toString("base64")}`;

		return { dataUrl, width: composition.width, height: composition.height };
	}
}

const ENTRYPOINT = "./bundle.tsx";
export const remotionService = new RemotionNodeProcessorService(
	require.resolve(ENTRYPOINT),
);
