import type { VirtualVideoData } from "@gatewai/core/types";
import {
	getActiveVideoMetadata,
	resolveVideoSourceUrl,
} from "./resolve-video.js";

/** Default filter values (no-op) */
const DEFAULT_FILTERS = {
	brightness: 100,
	contrast: 100,
	saturation: 100,
	hueRotate: 0,
	blur: 0,
	grayscale: 0,
	sepia: 0,
	invert: 0,
};

type Filters = typeof DEFAULT_FILTERS;

function mergeFilters(base: Filters, incoming: Partial<Filters>): Filters {
	return { ...base, ...incoming };
}

export function buildCSSFilterString(f: Filters): string {
	const parts: string[] = [];
	if (f.brightness !== 100) parts.push(`brightness(${f.brightness}%)`);
	if (f.contrast !== 100) parts.push(`contrast(${f.contrast}%)`);
	if (f.saturation !== 100) parts.push(`saturate(${f.saturation}%)`);
	if (f.hueRotate !== 0) parts.push(`hue-rotate(${f.hueRotate}deg)`);
	if (f.blur !== 0) parts.push(`blur(${f.blur}px)`);
	if (f.grayscale !== 0) parts.push(`grayscale(${f.grayscale}%)`);
	if (f.sepia !== 0) parts.push(`sepia(${f.sepia}%)`);
	if (f.invert !== 0) parts.push(`invert(${f.invert}%)`);
	return parts.join(" ");
}

export type CropRegion = {
	leftPct: number;
	topPct: number;
	widthPct: number;
	heightPct: number;
};

export type RenderParams = {
	sourceUrl: string | undefined;
	trimStartSec: number;
	trimEndSec: number | null;
	speed: number;
	cropRegion: CropRegion | null;
	flipH: boolean;
	flipV: boolean;
	rotation: number;
	cssFilterString: string;
	effectiveDurationSec: number;
};

/**
 * Compute render parameters for the CURRENT node only — does NOT recurse into
 * children. Each node in the VirtualVideo tree is responsible for exactly its
 * own operation; `SingleClipComposition` drives traversal via React recursion.
 *
 * This is the correct function to use inside the Remotion renderer.
 * For FFmpeg/export pipelines that need the fully-collapsed params for the
 * entire subtree, use `computeFullRenderParams` below.
 */
export function computeRenderParams(vv: VirtualVideoData): RenderParams {
	const op = vv.operation;
	const baseMeta = getActiveVideoMetadata(vv);

	const params: RenderParams = {
		sourceUrl: undefined,
		trimStartSec: 0,
		trimEndSec: null,
		speed: 1.0,
		cropRegion: null,
		flipH: false,
		flipV: false,
		rotation: 0,
		cssFilterString: "",
		effectiveDurationSec: 0,
	};

	let filters: Filters = { ...DEFAULT_FILTERS };

	switch (op.op) {
		case "source":
			params.sourceUrl = resolveVideoSourceUrl(vv);
			break;

		case "text":
			// Rendered as a DOM element by the caller; no media URL needed.
			params.sourceUrl = undefined;
			break;

		case "cut":
			params.trimStartSec = op.startSec;
			params.trimEndSec = op.endSec;
			break;

		case "speed":
			params.speed = op.rate;
			break;

		case "crop":
			params.cropRegion = {
				leftPct: op.leftPercentage,
				topPct: op.topPercentage,
				widthPct: op.widthPercentage,
				heightPct: op.heightPercentage,
			};
			break;

		case "filter":
			if (op.filters?.cssFilters) {
				filters = mergeFilters(filters, op.filters.cssFilters);
			}
			break;

		case "flip":
			params.flipH = op.horizontal ?? false;
			params.flipV = op.vertical ?? false;
			break;

		case "rotate":
			params.rotation = op.degrees % 360;
			break;

		// compose and layer: no per-node transform — handled structurally by
		// CompositionScene / LayerRenderer.
		case "compose":
		case "layer":
			break;
	}

	params.cssFilterString = buildCSSFilterString(filters);

	const sourceDurationSec = (baseMeta?.durationMs ?? 0) / 1000;
	params.effectiveDurationSec =
		((params.trimEndSec ?? sourceDurationSec) - params.trimStartSec) /
		params.speed;

	return params;
}

/**
 * Collapse the FULL operation subtree into a single flat RenderParams object.
 * Intended for server-side / FFmpeg rendering where all parameters must be
 * resolved up-front rather than applied incrementally via React recursion.
 *
 * Do NOT use this inside `SingleClipComposition` — it would cause every
 * operation to be applied twice (once here, once by the recursive renderer).
 */
export function computeFullRenderParams(vv: VirtualVideoData): RenderParams {
	const params: RenderParams = {
		sourceUrl: undefined,
		trimStartSec: 0,
		trimEndSec: null,
		speed: 1.0,
		cropRegion: null,
		flipH: false,
		flipV: false,
		rotation: 0,
		cssFilterString: "",
		effectiveDurationSec: 0,
	};

	let filters: Filters = { ...DEFAULT_FILTERS };
	const baseMeta = getActiveVideoMetadata(vv);
	let currentWidth = baseMeta?.width ?? 1920;
	let currentHeight = baseMeta?.height ?? 1080;

	function walk(node: VirtualVideoData | any) {
		if (!node) return;

		// Depth-first: process children before the current node so that
		// ancestor operations override descendant ones where they conflict.
		if (node.children && Array.isArray(node.children)) {
			for (const child of node.children) {
				walk(child);
			}
		}

		const op = node.operation;

		switch (op.op) {
			case "source":
				params.sourceUrl = resolveVideoSourceUrl(node);
				break;
			case "text":
				params.sourceUrl = undefined;
				break;
			case "cut":
				params.trimStartSec = op.startSec;
				params.trimEndSec = op.endSec;
				break;
			case "speed":
				params.speed *= op.rate;
				break;
			case "crop": {
				params.cropRegion = {
					leftPct: op.leftPercentage,
					topPct: op.topPercentage,
					widthPct: op.widthPercentage,
					heightPct: op.heightPercentage,
				};
				currentWidth = (op.widthPercentage / 100) * currentWidth;
				currentHeight = (op.heightPercentage / 100) * currentHeight;
				break;
			}
			case "filter":
				if (op.filters?.cssFilters) {
					filters = mergeFilters(filters, op.filters.cssFilters);
				}
				break;
			case "flip":
				if (op.horizontal) params.flipH = !params.flipH;
				if (op.vertical) params.flipV = !params.flipV;
				break;
			case "rotate":
				params.rotation = (params.rotation + op.degrees) % 360;
				if (op.degrees % 180 !== 0) {
					[currentWidth, currentHeight] = [currentHeight, currentWidth];
				}
				break;
			case "compose":
				currentWidth = op.width;
				currentHeight = op.height;
				params.cropRegion = null;
				params.trimStartSec = 0;
				params.trimEndSec = null;
				params.speed = 1.0;
				params.flipH = false;
				params.flipV = false;
				params.rotation = 0;
				filters = { ...DEFAULT_FILTERS };
				break;
			case "layer":
				break;
		}
	}

	walk(vv);

	params.cssFilterString = buildCSSFilterString(filters);
	const sourceDurationSec = (baseMeta?.durationMs ?? 0) / 1000;
	params.effectiveDurationSec =
		((params.trimEndSec ?? sourceDurationSec) - params.trimStartSec) /
		params.speed;

	return params;
}
