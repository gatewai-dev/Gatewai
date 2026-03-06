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
	computeVideoCropRenderProps,
	createVirtualMedia,
	DEFAULT_DURATION_MS,
	getActiveMediaMetadata,
	TEXT_LAYER_DEFAULTS,
} from "@gatewai/remotion-compositions";
import { resolveMediaSourceUrlBrowser } from "@gatewai/remotion-compositions/browser";
import { renderMediaOnWeb } from "@remotion/web-renderer";
import type {
	VideoCompositorLayer,
	VideoCompositorNodeConfig,
} from "../shared/config.js";

// ---------------------------------------------------------------------------
// Helpers — mirrors editor helpers verbatim
// ---------------------------------------------------------------------------

/**
 * Recursively resolves the effective playback duration of a VirtualMediaData
 * tree, fully respecting cut and speed operations. Mirrors the editor's
 * getEffectiveDurationMs so that the muxer clamps durations identically to
 * what the player shows.
 */
function getEffectiveDurationMs(
	virtualMedia: VirtualMediaData | undefined | null,
	accumulatedStartSec = 0,
): number | null {
	if (!virtualMedia) return null;
	const op = virtualMedia.operation;

	if (op?.op === "cut") {
		const cutStart = (Number(op.startSec) || 0) + accumulatedStartSec;
		const cutEnd = Number(op.endSec) || 0;
		const cutDurationMs = Math.max(0, cutEnd - cutStart) * 1000;
		const child = virtualMedia.children?.[0];
		if (child) {
			const childDurationMs = getEffectiveDurationMs(child, cutStart);
			if (childDurationMs !== null)
				return Math.min(cutDurationMs, childDurationMs);
		}
		return cutDurationMs;
	}

	if (op?.op === "speed") {
		const rate = Number(op.rate) || 1;
		const child = virtualMedia.children?.[0];
		if (child) {
			const childMs = getEffectiveDurationMs(child, accumulatedStartSec / rate);
			if (childMs !== null) return childMs * rate;
		}
		return null;
	}

	for (const child of virtualMedia.children ?? []) {
		const found = getEffectiveDurationMs(child, accumulatedStartSec);
		if (found !== null) return found;
	}

	return null;
}

/**
 * Measures a text string's rendered pixel dimensions via a hidden DOM element.
 * Mirrors the editor's measureText helper so that Text layer sizing in the
 * muxer is identical to the editor.
 */
function measureText(
	text: string,
	style: Partial<ExtendedLayer>,
): { width: number; height: number } {
	if (typeof document === "undefined") return { width: 100, height: 40 };

	const d = document.createElement("div");
	Object.assign(d.style, {
		fontFamily: style.fontFamily ?? "Inter",
		fontSize: `${style.fontSize ?? 40}px`,
		fontWeight: String(style.fontWeight ?? "normal"),
		fontStyle: style.fontStyle ?? "normal",
		letterSpacing: `${style.letterSpacing ?? 0}px`,
		lineHeight: `${style.lineHeight ?? 1.2}`,
		padding: `${style.padding ?? 0}px`,
		position: "absolute",
		visibility: "hidden",
		whiteSpace: "pre",
		width: "max-content",
	});
	d.textContent = text;
	document.body.appendChild(d);
	const width = d.offsetWidth;
	const height = d.offsetHeight;
	document.body.removeChild(d);
	return { width, height };
}

// ---------------------------------------------------------------------------
// Layer builder — per-type logic mirrors editor's loadInitialLayers exactly
// ---------------------------------------------------------------------------

/**
 * Build a render-ready ExtendedLayer from a saved VideoCompositorLayer and its
 * live NodeProcessorParams input.  Each branch applies the same defaults,
 * fallbacks, and computed values that the editor's loadInitialLayers effect
 * produces, so the muxer is always pixel-identical to the editor preview.
 *
 * @param layer          - Saved layer config (from VideoCompositorNodeConfig.layerUpdates)
 * @param input          - Live input data from the node graph
 * @param viewportWidth  - Canvas render width
 * @param viewportHeight - Canvas render height
 */
function buildExtendedLayer(
	layer: VideoCompositorLayer,
	input: NodeProcessorParams["inputs"][string],
	viewportWidth: number,
	viewportHeight: number,
): ExtendedLayer | null {
	if (!input?.outputItem) return null;

	const item = input.outputItem;
	const itemType = item.type;
	const saved = layer;

	// -- Shared state resolved per-type below --------------------------------
	let text: string | undefined;
	let src: string | undefined;
	let virtualMedia: VirtualMediaData | undefined;
	let layerWidth = saved.width;
	let layerHeight = saved.height;
	let cropRenderProps: ReturnType<typeof computeVideoCropRenderProps> = null;

	// ── Resolve source data --------------------------------------------------
	if (itemType === "Text") {
		text = String(item.data);
	} else if (itemType === "Video" || itemType === "Audio") {
		virtualMedia = item.data as VirtualMediaData;
		const metadata = getActiveMediaMetadata(virtualMedia);
		src = resolveMediaSourceUrlBrowser(virtualMedia);
		cropRenderProps = computeVideoCropRenderProps(virtualMedia);

		// Mirrors editor: autoDimensions defaults true for new layers
		const isAutoDimensions = saved.autoDimensions ?? true;
		if (isAutoDimensions) {
			layerWidth = metadata?.width ?? undefined;
			layerHeight = metadata?.height ?? undefined;
		} else {
			layerWidth = layerWidth ?? metadata?.width ?? undefined;
			layerHeight = layerHeight ?? metadata?.height ?? undefined;
		}
	} else if (
		itemType === "Image" ||
		itemType === "SVG" ||
		itemType === "Caption"
	) {
		const fileData = item.data as FileData;
		virtualMedia = createVirtualMedia(fileData, itemType);
		src = resolveMediaSourceUrlBrowser(virtualMedia);

		if (itemType !== "Caption") {
			const naturalW =
				fileData.processData?.width ?? fileData.entity?.width ?? undefined;
			const naturalH =
				fileData.processData?.height ?? fileData.entity?.height ?? undefined;
			const isAutoDimensions = saved.autoDimensions ?? true;

			if (isAutoDimensions && naturalW != null && naturalH != null) {
				layerWidth = naturalW;
				layerHeight = naturalH;
			} else {
				layerWidth = layerWidth ?? naturalW;
				layerHeight = layerHeight ?? naturalH;
			}
		}
	}

	const baseAnimations = saved.animations ?? [];

	// =========================================================================
	// TEXT
	// =========================================================================
	if (itemType === "Text") {
		// Pull TEXT_LAYER_DEFAULTS but strip captionPreset (irrelevant for Text)
		const { captionPreset: _cp, ...textDefaults } = TEXT_LAYER_DEFAULTS;

		const fontFamily =
			saved.fontFamily ?? (TEXT_LAYER_DEFAULTS.fontFamily as string);
		const fontSize = saved.fontSize ?? (TEXT_LAYER_DEFAULTS.fontSize as number);
		const fontStyle =
			saved.fontStyle ?? (TEXT_LAYER_DEFAULTS.fontStyle as string);
		const fontWeight = saved.fontWeight ?? TEXT_LAYER_DEFAULTS.fontWeight;
		const lineHeight =
			saved.lineHeight ?? (TEXT_LAYER_DEFAULTS.lineHeight as number);
		const padding = saved.padding ?? (TEXT_LAYER_DEFAULTS.padding as number);
		const letterSpacing =
			saved.letterSpacing ?? TEXT_LAYER_DEFAULTS.letterSpacing;

		// Measure dimensions when not persisted (same logic as editor)
		if (!layerWidth || !layerHeight) {
			const dims = measureText(text ?? "", {
				fontFamily,
				fontSize,
				fontStyle,
				fontWeight,
				letterSpacing,
				lineHeight,
				padding,
			});
			layerWidth = dims.width;
			layerHeight = dims.height;
		}

		const result: ExtendedLayer = {
			// Type defaults first, so explicit saved values can override them below
			...textDefaults,
			id: saved.id ?? generateId(),
			inputHandleId: saved.inputHandleId,
			type: "Text",
			// Text layers use a virtual wrapper, not a raw src URL
			src: undefined,
			virtualMedia: createVirtualMedia(text ?? "", "Text"),
			text,
			x: saved.x ?? 0,
			y: saved.y ?? 0,
			width: layerWidth,
			height: layerHeight,
			rotation: saved.rotation ?? 0,
			scale: saved.scale ?? 1,
			opacity: saved.opacity ?? 1,
			startFrame: saved.startFrame ?? 0,
			durationInMS: saved.durationInMS ?? DEFAULT_DURATION_MS,
			zIndex: saved.zIndex ?? 0,
			lockAspect: true,
			autoDimensions: false,
			volume: saved.volume ?? 1,
			animations: baseAnimations,
			fill: saved.fill ?? (TEXT_LAYER_DEFAULTS.fill as string),
			fontSize,
			fontFamily,
			fontStyle,
			fontWeight,
			textDecoration:
				saved.textDecoration ?? (TEXT_LAYER_DEFAULTS.textDecoration as string),
			align: saved.align ?? (TEXT_LAYER_DEFAULTS.align as string),
			letterSpacing,
			lineHeight,
			padding,
		};

		// Carry forward optional persisted overrides without stomping defaults
		// with undefined values
		if (saved.backgroundColor !== undefined)
			result.backgroundColor = saved.backgroundColor;
		if (saved.stroke !== undefined) result.stroke = saved.stroke;
		if (saved.strokeWidth !== undefined) result.strokeWidth = saved.strokeWidth;
		if (saved.textShadow !== undefined) result.textShadow = saved.textShadow;
		if (saved.useRoundedTextBox !== undefined)
			result.useRoundedTextBox = saved.useRoundedTextBox;
		if (saved.borderRadius !== undefined)
			result.borderRadius = saved.borderRadius;
		if (saved.verticalAlign !== undefined)
			result.verticalAlign = saved.verticalAlign;

		return result;
	}

	// =========================================================================
	// CAPTION
	// =========================================================================
	if (itemType === "Caption") {
		const fSize = saved.fontSize ?? (CAPTION_LAYER_DEFAULTS.fontSize as number);
		const lHeight =
			saved.lineHeight ?? (CAPTION_LAYER_DEFAULTS.lineHeight as number);
		const pad = saved.padding ?? 0;

		// Auto-height: enough for ~3 subtitle lines — mirrors editor exactly
		const autoHeight = Math.round(fSize * lHeight * 3 + pad * 2);

		// Default bottom-of-canvas placement with 10 % margin
		const defaultY = Math.max(
			0,
			viewportHeight - autoHeight - Math.round(viewportHeight * 0.1),
		);

		// Migrate legacy fullscreen-height captions to correct placement
		const isLegacyFullscreen =
			saved.height !== undefined && saved.height >= viewportHeight * 0.9;
		const captionY = isLegacyFullscreen ? defaultY : (saved.y ?? defaultY);

		const result: ExtendedLayer = {
			...CAPTION_LAYER_DEFAULTS,
			id: saved.id ?? generateId(),
			inputHandleId: saved.inputHandleId,
			type: "Caption",
			src,
			virtualMedia,
			text: undefined,
			x: saved.x ?? 0,
			y: captionY,
			// Caption always spans full canvas width — mirrors editor
			width: viewportWidth,
			height: autoHeight,
			rotation: saved.rotation ?? 0,
			scale: saved.scale ?? 1,
			opacity: saved.opacity ?? 1,
			startFrame: saved.startFrame ?? 0,
			durationInMS: saved.durationInMS ?? DEFAULT_DURATION_MS,
			zIndex: saved.zIndex ?? 0,
			lockAspect: false,
			autoDimensions: false,
			volume: saved.volume ?? 1,
			animations: baseAnimations,
			fontSize: fSize,
			fontFamily: saved.fontFamily ?? "Inter",
			fill: saved.fill ?? "#ffffff",
			align: saved.align ?? "center",
			captionPreset: saved.captionPreset ?? "default",
		};

		if (saved.textShadow !== undefined) result.textShadow = saved.textShadow;
		if (saved.useRoundedTextBox !== undefined)
			result.useRoundedTextBox = saved.useRoundedTextBox;
		if (saved.backgroundColor !== undefined)
			result.backgroundColor = saved.backgroundColor;
		if (saved.borderRadius !== undefined)
			result.borderRadius = saved.borderRadius;
		if (saved.stroke !== undefined) result.stroke = saved.stroke;
		if (saved.strokeWidth !== undefined) result.strokeWidth = saved.strokeWidth;

		return result;
	}

	// =========================================================================
	// AUDIO
	// =========================================================================
	if (itemType === "Audio") {
		return {
			id: saved.id ?? generateId(),
			inputHandleId: saved.inputHandleId,
			type: "Audio",
			src,
			virtualMedia,
			text: undefined,
			// Audio has no visual footprint
			x: 0,
			y: 0,
			width: 0,
			height: 0,
			rotation: 0,
			scale: 1,
			opacity: 1,
			startFrame: saved.startFrame ?? 0,
			durationInMS: saved.durationInMS ?? DEFAULT_DURATION_MS,
			zIndex: saved.zIndex ?? 0,
			lockAspect: true,
			autoDimensions: false,
			volume: saved.volume ?? 1,
			animations: baseAnimations,
		};
	}

	// =========================================================================
	// VIDEO
	// =========================================================================
	if (itemType === "Video") {
		const result: ExtendedLayer = {
			id: saved.id ?? generateId(),
			inputHandleId: saved.inputHandleId,
			type: "Video",
			src,
			virtualMedia,
			text: undefined,
			x: saved.x ?? 0,
			y: saved.y ?? 0,
			width: layerWidth ?? 400,
			height: layerHeight ?? 400,
			rotation: saved.rotation ?? 0,
			scale: saved.scale ?? 1,
			opacity: saved.opacity ?? 1,
			startFrame: saved.startFrame ?? 0,
			durationInMS: saved.durationInMS ?? DEFAULT_DURATION_MS,
			zIndex: saved.zIndex ?? 0,
			lockAspect: saved.lockAspect ?? true,
			autoDimensions: saved.autoDimensions ?? true,
			volume: saved.volume ?? 1,
			animations: baseAnimations,
			// Apply crop render props (handles crop/pan video operations)
			...(cropRenderProps ?? {}),
		};

		// Carry forward optional persisted overrides
		if (saved.filters !== undefined) result.filters = saved.filters;
		if (saved.trimStart !== undefined) result.trimStart = saved.trimStart;
		if (saved.trimEnd !== undefined) result.trimEnd = saved.trimEnd;
		if (saved.speed !== undefined) result.speed = saved.speed;
		if (saved.backgroundColor !== undefined)
			result.backgroundColor = saved.backgroundColor;
		if (saved.borderColor !== undefined) result.borderColor = saved.borderColor;
		if (saved.borderWidth !== undefined) result.borderWidth = saved.borderWidth;
		if (saved.borderRadius !== undefined)
			result.borderRadius = saved.borderRadius;

		return result;
	}

	// =========================================================================
	// IMAGE / SVG
	// =========================================================================
	if (itemType === "Image" || itemType === "SVG") {
		const result: ExtendedLayer = {
			id: saved.id ?? generateId(),
			inputHandleId: saved.inputHandleId,
			type: itemType as "Image" | "SVG",
			src,
			virtualMedia,
			text: undefined,
			x: saved.x ?? 0,
			y: saved.y ?? 0,
			width: layerWidth ?? 400,
			height: layerHeight ?? 400,
			rotation: saved.rotation ?? 0,
			scale: saved.scale ?? 1,
			opacity: saved.opacity ?? 1,
			startFrame: saved.startFrame ?? 0,
			durationInMS: saved.durationInMS ?? DEFAULT_DURATION_MS,
			zIndex: saved.zIndex ?? 0,
			lockAspect: saved.lockAspect ?? true,
			autoDimensions: saved.autoDimensions ?? true,
			volume: saved.volume ?? 1,
			animations: baseAnimations,
		};

		if (saved.backgroundColor !== undefined)
			result.backgroundColor = saved.backgroundColor;
		if (saved.borderColor !== undefined) result.borderColor = saved.borderColor;
		if (saved.borderWidth !== undefined) result.borderWidth = saved.borderWidth;
		if (saved.borderRadius !== undefined)
			result.borderRadius = saved.borderRadius;
		if (saved.filters !== undefined) result.filters = saved.filters;

		return result;
	}

	return null;
}

/**
 * Remotion Browser Renderer
 * It is not stable, but keeping code for future ref.
 */

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

		const hasConfigLayers =
			config.layerUpdates && Object.keys(config.layerUpdates).length > 0;

		if (hasConfigLayers) {
			// -- Step 1: Process all explicitly configured layers ------------------
			const configPromises: Promise<void>[] = [];

			for (const layerKey in config.layerUpdates) {
				const layer = config.layerUpdates[layerKey];
				layerUpdatesCopy[layerKey] = { ...layer };

				const input = inputDataMap[layer.inputHandleId];
				if (!input?.outputItem) continue;

				const item = input.outputItem;
				if (item.type === "Video" || item.type === "Audio") {
					configPromises.push(
						this.resolveMediaDurationSec(
							item.data as VirtualMediaData,
							item.type,
						).then((durSec) => {
							const actualMS = durSec * 1000;
							const requestedDurationMS = layer.durationInMS ?? actualMS;
							layerUpdatesCopy[layerKey].durationInMS = Math.max(
								1,
								Math.min(requestedDurationMS, actualMS),
							);
						}),
					);
				} else if (layer.durationInMS == null) {
					layerUpdatesCopy[layerKey].durationInMS = DEFAULT_DURATION_MS;
				}
			}

			await Promise.all(configPromises);

			// -- Step 2: Pick up inputs not referenced by any configured layer ----
			// This covers the case where an Audio (or any other) input is connected
			// to the node but was never saved into layerUpdates — e.g. a track that
			// was wired up after the last save.
			const coveredHandles = new Set(
				Object.values(layerUpdatesCopy).map((l) => l.inputHandleId),
			);

			let maxZ = Math.max(
				0,
				...Object.values(layerUpdatesCopy).map((l) => l.zIndex ?? 0),
			);

			const uncoveredPromises: Promise<void>[] = [];

			for (const inputHandleId in inputDataMap) {
				if (coveredHandles.has(inputHandleId)) continue;

				const input = inputDataMap[inputHandleId];
				if (!input?.outputItem) continue;

				const item = input.outputItem;
				const defaultLayer = this.makeDefaultLayer(
					inputHandleId,
					item.type,
					++maxZ,
				);

				if (item.type === "Video" || item.type === "Audio") {
					uncoveredPromises.push(
						this.resolveMediaDurationSec(
							item.data as VirtualMediaData,
							item.type,
						).then((durSec) => {
							defaultLayer.durationInMS = Math.max(1, durSec * 1000);
							layerUpdatesCopy[inputHandleId] = defaultLayer;
						}),
					);
				} else {
					defaultLayer.durationInMS = DEFAULT_DURATION_MS;
					layerUpdatesCopy[inputHandleId] = defaultLayer;
				}
			}

			await Promise.all(uncoveredPromises);
		} else {
			// -- No saved config: generate sensible defaults for every input -------
			let zIndex = 0;
			const defaultPromises: Promise<void>[] = [];

			for (const inputHandleId in inputDataMap) {
				const input = inputDataMap[inputHandleId];
				if (!input?.outputItem) continue;

				const item = input.outputItem;
				const itemType = item.type;

				// Text and Image layers go on top of Video/Audio by default
				const layerZ =
					itemType === "Text" || itemType === "Image"
						? 100 + zIndex++
						: zIndex++;

				const defaultLayer = this.makeDefaultLayer(
					inputHandleId,
					itemType,
					layerZ,
				);

				if (itemType === "Video" || itemType === "Audio") {
					defaultPromises.push(
						this.resolveMediaDurationSec(
							item.data as VirtualMediaData,
							itemType as "Video" | "Audio",
						).then((durSec) => {
							defaultLayer.durationInMS = Math.max(1, durSec * 1000);
							layerUpdatesCopy[inputHandleId] = defaultLayer;
						}),
					);
				} else {
					defaultLayer.durationInMS = DEFAULT_DURATION_MS;
					layerUpdatesCopy[inputHandleId] = defaultLayer;
				}
			}

			await Promise.all(defaultPromises);
		}

		// -- Compute total timeline duration from all layers --------------------
		const totalDurationMS = Math.max(
			...Object.values(layerUpdatesCopy).map(
				(l) => ((l.startFrame ?? 0) / fps) * 1000 + (l.durationInMS ?? 0),
			),
			1,
		);
		const totalDurationInFrames = Math.ceil((totalDurationMS / 1000) * fps);

		// -- Build ExtendedLayer[] using the editor-identical builder ----------
		const extendedLayers: ExtendedLayer[] = [];
		for (const layerKey in layerUpdatesCopy) {
			const layer = layerUpdatesCopy[layerKey];
			const input = inputDataMap[layer.inputHandleId];
			const extLayer = buildExtendedLayer(layer, input, width, height);
			if (extLayer) extendedLayers.push(extLayer);
		}

		// -- Render ------------------------------------------------------------
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

	// ---------------------------------------------------------------------------
	// Private helpers
	// ---------------------------------------------------------------------------

	/**
	 * Creates a minimal VideoCompositorLayer skeleton that buildExtendedLayer
	 * can then enrich with per-type defaults. Kept deliberately sparse so that
	 * buildExtendedLayer's default logic is the single source of truth.
	 */
	private makeDefaultLayer(
		inputHandleId: string,
		itemType: string,
		zIndex: number,
	): VideoCompositorLayer {
		return {
			inputHandleId,
			id: generateId(),
			type: itemType as VideoCompositorLayer["type"],
			zIndex,
			startFrame: 0,
			x: 0,
			y: 0,
			scale: 1,
			rotation: 0,
			lockAspect: true,
			opacity: 1,
			volume: itemType === "Video" || itemType === "Audio" ? 1 : undefined,
		};
	}

	/**
	 * Resolves the true playback duration of a media item in seconds.
	 *
	 * Resolution order (mirrors how the editor sources durations):
	 *   1. cut/speed-aware effective duration  (getEffectiveDurationMs)
	 *   2. raw metadata durationMs             (getActiveMediaMetadata)
	 *   3. media-element probe                 (HTMLVideoElement / HTMLAudioElement)
	 */
	private async resolveMediaDurationSec(
		data: VirtualMediaData,
		type: "Video" | "Audio",
	): Promise<number> {
		// 1. Cut / speed-aware duration — most accurate for edited clips
		const effectiveMs = getEffectiveDurationMs(data);
		if (effectiveMs != null && effectiveMs > 0) return effectiveMs / 1000;

		// 2. Raw metadata — fast, no network round-trip
		const meta = getActiveMediaMetadata(data);
		if (meta?.durationMs) return meta.durationMs / 1000;

		// 3. Probe via media element — slowest but most reliable fallback
		const url = resolveMediaSourceUrlBrowser(data);
		if (!url) return 0;

		return new Promise<number>((resolve) => {
			const tag = type === "Audio" ? "audio" : "video";
			const el = document.createElement(tag) as
				| HTMLAudioElement
				| HTMLVideoElement;
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
