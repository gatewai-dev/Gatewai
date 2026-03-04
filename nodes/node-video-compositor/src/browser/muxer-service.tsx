import { generateId } from "@gatewai/core";
import type {
	ExtendedLayer,
	FileData,
	NodeProcessorParams,
	VirtualMediaData,
} from "@gatewai/core/types";
import {
	CAPTION_LAYER_DEFAULTS,
	CompositionScene,
	createVirtualMedia,
	DEFAULT_DURATION_MS,
	getActiveMediaMetadata,
	LOTTIE_LAYER_DEFAULTS,
	TEXT_LAYER_DEFAULTS,
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

	const src = virtualMedia
		? resolveMediaSourceUrlBrowser(virtualMedia)
		: undefined;
	const activeMeta = virtualMedia ? getActiveMediaMetadata(virtualMedia) : null;

	// Prepare layer-specific defaults (only for specific types)
	const layerTypeDefaults =
		itemType === "Text"
			? TEXT_LAYER_DEFAULTS
			: itemType === "Caption"
				? CAPTION_LAYER_DEFAULTS
				: itemType === "Lottie"
					? LOTTIE_LAYER_DEFAULTS
					: {};

	// Create the result by merging:
	// 1. Per-type defaults (Text/Caption/Lottie)
	// 2. Base fields (coordinates, ID, etc.)
	// 3. Layer config (only non-undefined values)
	// We do this to ensure defaults are NOT overwritten by 'undefined' in the 'layer' object.

	const result: ExtendedLayer = {
		...layerTypeDefaults,
		id: layer.id ?? generateId(),
		inputHandleId: layer.inputHandleId,
		type: (layer.type ?? itemType) as ExtendedLayer["type"],
		src,
		virtualMedia,
		text,
		x: layer.x ?? 0,
		y: layer.y ?? 0,
		width: layer.width ?? activeMeta?.width ?? undefined,
		height: layer.height ?? activeMeta?.height ?? undefined,
		rotation: layer.rotation ?? 0,
		scale: layer.scale ?? 1,
		opacity: layer.opacity ?? 1,
		startFrame: layer.startFrame ?? 0,
		durationInMS: layer.durationInMS ?? 0,
		zIndex: layer.zIndex ?? 0,
		lockAspect: layer.lockAspect ?? true,
		volume: layer.volume ?? 1,
	};

	// Explicitly assign optional fields if they are defined in 'layer'
	const optionalFields: (keyof ExtendedLayer)[] = [
		"fill",
		"fontSize",
		"fontFamily",
		"fontStyle",
		"fontWeight",
		"textDecoration",
		"textShadow",
		"align",
		"verticalAlign",
		"letterSpacing",
		"lineHeight",
		"padding",
		"stroke",
		"strokeWidth",
		"backgroundColor",
		"borderColor",
		"borderWidth",
		"borderRadius",
		"autoDimensions",
		"animations",
		"trimStart",
		"trimEnd",
		"speed",
		"filters",
		"lottieLoop",
		"lottieFrameRate",
		"lottieDurationMs",
		"captionPreset",
		"useRoundedTextBox",
	];

	for (const key of optionalFields) {
		if ((layer as any)[key] !== undefined) {
			(result as any)[key] = (layer as any)[key];
		}
	}

	return result;
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
					layerUpdatesCopy[layerKey].durationInMS = DEFAULT_DURATION_MS;
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

				let defaultWidth: number | undefined;
				let defaultHeight: number | undefined;

				if (itemType === "Image" || itemType === "SVG") {
					const fileData = item.data as FileData;
					defaultWidth =
						fileData.processData?.width ?? fileData.entity?.width ?? undefined;
					defaultHeight =
						fileData.processData?.height ??
						fileData.entity?.height ??
						undefined;
				}

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
					width: defaultWidth,
					height: defaultHeight,
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
					defaultLayer.durationInMS = DEFAULT_DURATION_MS;
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

export const remotionWebRendererService = new RemotionWebProcessorService();
