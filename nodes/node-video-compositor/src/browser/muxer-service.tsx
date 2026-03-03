import { generateId } from "@gatewai/core";
import type {
	ExtendedLayer,
	FileData,
	NodeProcessorParams,
	VirtualMediaData,
} from "@gatewai/core/types";
import {
	CompositionScene,
	createVirtualMedia,
	getActiveMediaMetadata,
} from "@gatewai/remotion-compositions";
import { resolveMediaSourceUrlBrowser } from "@gatewai/remotion-compositions/browser";
import { renderMediaOnWeb } from "@remotion/web-renderer";
import type {
	VideoCompositorLayer,
	VideoCompositorNodeConfig,
} from "../shared/config.js";

/**
 * Build an ExtendedLayer from a VideoCompositorLayer config entry and its input data.
 */
function buildExtendedLayer(
	layer: VideoCompositorLayer,
	input: NodeProcessorParams["inputs"][string],
): ExtendedLayer | null {
	if (!input?.outputItem) return null;

	const item = input.outputItem;
	const itemType = item.type;

	// Resolve virtualMedia based on the type
	let virtualMedia: VirtualMediaData | undefined;
	let text: string | undefined;

	if (itemType === "Video" || itemType === "Audio" || itemType === "Lottie") {
		// Already VirtualMediaData
		virtualMedia = item.data as VirtualMediaData;
	} else if (
		itemType === "Image" ||
		itemType === "SVG" ||
		itemType === "Caption"
	) {
		// FileData → wrap in VirtualMediaData
		virtualMedia = createVirtualMedia(item.data as FileData, itemType);
	} else if (itemType === "Text") {
		text = String(item.data);
	}

	return {
		id: layer.id ?? generateId(),
		inputHandleId: layer.inputHandleId,
		type: (layer.type ?? itemType) as ExtendedLayer["type"],
		virtualMedia,
		text,
		x: layer.x ?? 0,
		y: layer.y ?? 0,
		width: layer.width,
		height: layer.height,
		rotation: layer.rotation ?? 0,
		scale: layer.scale ?? 1,
		opacity: layer.opacity ?? 1,
		startFrame: layer.startFrame ?? 0,
		durationInMS: layer.durationInMS,
		zIndex: layer.zIndex,
		lockAspect: layer.lockAspect ?? true,
		volume:
			itemType === "Video" || itemType === "Audio"
				? (layer.volume ?? 1)
				: undefined,
		// Styling
		fill: layer.fill,
		fontSize: layer.fontSize,
		fontFamily: layer.fontFamily,
		fontStyle: layer.fontStyle,
		fontWeight: layer.fontWeight,
		textDecoration: layer.textDecoration,
		textShadow: layer.textShadow,
		align: layer.align,
		verticalAlign: layer.verticalAlign,
		letterSpacing: layer.letterSpacing,
		lineHeight: layer.lineHeight,
		padding: layer.padding,
		stroke: layer.stroke,
		strokeWidth: layer.strokeWidth,
		backgroundColor: layer.backgroundColor,
		borderColor: layer.borderColor,
		borderWidth: layer.borderWidth,
		borderRadius: layer.borderRadius,
		autoDimensions: layer.autoDimensions,
		animations: layer.animations,
		// Media
		trimStart: layer.trimStart,
		trimEnd: layer.trimEnd,
		speed: layer.speed,
		filters: layer.filters,
		// Lottie
		lottieLoop: layer.lottieLoop,
		lottieFrameRate: layer.lottieFrameRate,
		lottieDurationMs: layer.lottieDurationMs,
		// Caption
		captionPreset: layer.captionPreset,
		useRoundedTextBox: layer.useRoundedTextBox,
	} as ExtendedLayer;
}

export class RemotionWebProcessorService {
	async processVideo(
		config: VideoCompositorNodeConfig,
		inputDataMap: NodeProcessorParams["inputs"],
		signal?: AbortSignal,
	): Promise<{ dataUrl: string; width: number; height: number }> {
		const width = config.width ?? 1280;
		const height = config.height ?? 720;
		const fps = config.FPS ?? 24;

		const layerUpdatesCopy: Record<string, VideoCompositorLayer> = {};
		const mediaPromises: Promise<void>[] = [];

		// Initialize layerUpdatesCopy from existing config or create defaults
		const hasConfigLayers =
			config.layerUpdates && Object.keys(config.layerUpdates).length > 0;

		if (hasConfigLayers) {
			for (const layerKey in config.layerUpdates) {
				const layer = config.layerUpdates[layerKey];
				layerUpdatesCopy[layerKey] = { ...layer };

				const input = inputDataMap[layer.inputHandleId];
				if (!input?.outputItem) continue;

				const item = input.outputItem;
				if (
					item.type === "Video" ||
					item.type === "Audio" ||
					item.type === "Lottie"
				) {
					const promise = this.getMediaDurationAsSec(
						item.data as VirtualMediaData,
						item.type,
					).then((durSec) => {
						const actualMS = durSec * 1000;
						const requestedDurationMS = layer.durationInMS ?? actualMS;
						layerUpdatesCopy[layerKey].durationInMS = Math.max(
							1,
							Math.min(requestedDurationMS, actualMS),
						);
					});
					mediaPromises.push(promise);
				} else if (layer.durationInMS == null) {
					layerUpdatesCopy[layerKey].durationInMS = 5000;
				}
			}
		} else {
			// Logic for generating default layers when no config exists
			let zIndex = 0;
			for (const inputHandleId in inputDataMap) {
				const input = inputDataMap[inputHandleId];
				if (!input?.outputItem) continue;

				const item = input.outputItem;
				const itemType = item.type;

				// Create a base default layer
				const defaultLayer: VideoCompositorLayer = {
					inputHandleId,
					zIndex:
						itemType === "Text" || itemType === "Image"
							? 100 + zIndex++
							: zIndex++,
					startFrame: 0,
					type: itemType as VideoCompositorLayer["type"],
					x: 0,
					y: 0,
					scale: 1,
					rotation: 0,
					id: generateId(),
					lockAspect: true,
					opacity: 1,
					volume: itemType === "Video" || itemType === "Audio" ? 1 : undefined,
				};

				if (
					itemType === "Video" ||
					itemType === "Audio" ||
					itemType === "Lottie"
				) {
					const promise = this.getMediaDurationAsSec(
						item.data as VirtualMediaData,
						itemType,
					).then((durSec) => {
						defaultLayer.durationInMS = Math.max(1, durSec * 1000);
						layerUpdatesCopy[inputHandleId] = defaultLayer;
					});
					mediaPromises.push(promise);
				} else {
					defaultLayer.durationInMS = 5000;
					layerUpdatesCopy[inputHandleId] = defaultLayer;
				}
			}
		}

		await Promise.all(mediaPromises);

		// Calculate total duration based on the clamped layers
		const totalDurationMS = Math.max(
			...Object.values(layerUpdatesCopy).map(
				(l) => ((l.startFrame ?? 0) / fps) * 1000 + (l.durationInMS ?? 0),
			),
			1,
		);

		const totalDurationInFrames = Math.ceil((totalDurationMS / 1000) * fps);

		// Build ExtendedLayer[] from the resolved layerUpdatesCopy
		const extendedLayers: ExtendedLayer[] = [];
		for (const layerKey in layerUpdatesCopy) {
			const layer = layerUpdatesCopy[layerKey];
			const input = inputDataMap[layer.inputHandleId];
			const extLayer = buildExtendedLayer(layer, input);
			if (extLayer) {
				extendedLayers.push(extLayer);
			}
		}

		const { getBlob } = await renderMediaOnWeb({
			signal,
			licenseKey: "free-license",
			composition: {
				id: "dynamic-video",
				component: CompositionScene as any,
				durationInFrames: totalDurationInFrames,
				fps,
				width,
				height,
				defaultProps: {
					layers: extendedLayers,
					viewportWidth: width,
					viewportHeight: height,
					backgroundColor: config.backgroundColor,
				},
			},
			inputProps: {
				layers: extendedLayers,
				viewportWidth: width,
				viewportHeight: height,
				backgroundColor: config.backgroundColor,
			},
		});

		if (signal?.aborted) throw new Error("Aborted");

		const blob = await getBlob();
		return { dataUrl: URL.createObjectURL(blob), width, height };
	}

	private async getMediaDurationAsSec(
		data: VirtualMediaData,
		type: "Video" | "Audio" | "Lottie",
	): Promise<number> {
		// Try to read duration from VirtualMediaData metadata first
		const meta = getActiveMediaMetadata(data);
		if (meta?.durationMs) {
			return meta.durationMs / 1000;
		}

		// Fall back to loading the media element from URL
		const url = resolveMediaSourceUrlBrowser(data);
		if (!url) return 0;

		if (type === "Audio") {
			return new Promise((resolve) => {
				const el = document.createElement("audio");
				el.preload = "metadata";
				el.src = url;

				el.onloadedmetadata = () => {
					const duration = el.duration || 0;
					el.onloadedmetadata = null;
					el.onerror = null;
					el.src = "";
					el.load();
					resolve(duration);
				};

				el.onerror = () => {
					el.src = "";
					resolve(0);
				};
			});
		}

		// Video / Lottie — probe as video element
		return new Promise((resolve) => {
			const el = document.createElement("video");
			el.preload = "metadata";
			el.src = url;
			el.onloadedmetadata = () => {
				const duration = el.duration || 0;
				el.onloadedmetadata = null;
				el.onerror = null;
				el.src = "";
				el.load();
				resolve(duration);
			};
			el.onerror = () => {
				el.src = "";
				resolve(0);
			};
		});
	}
}

export const remotionService = new RemotionWebProcessorService();
