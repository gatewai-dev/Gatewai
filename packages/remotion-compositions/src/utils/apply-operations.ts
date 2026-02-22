import type { VirtualVideoData } from "@gatewai/core/types";
import { resolveVideoSourceUrl } from "./resolve-video.js";

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

export type RenderParams = {
	sourceUrl: string | undefined;
	trimStartSec: number;
	trimEndSec: number | null;
	speed: number;
	cropRegion: { x: number; y: number; width: number; height: number } | null;
	flipH: boolean;
	flipV: boolean;
	rotation: number;
	cssFilterString: string;
	effectiveDurationSec: number;
};

/**
 * Collapse the full operation stack into concrete render parameters
 * for Remotion or FFmpeg.
 */
export function computeRenderParams(vv: VirtualVideoData): RenderParams {
	let trimStartSec = 0;
	let trimEndSec: number | null = null;
	let speed = 1.0;
	let cropRegion: {
		x: number;
		y: number;
		width: number;
		height: number;
	} | null = null;
	let flipH = false;
	let flipV = false;
	let rotation = 0;
	let filters: Filters = { ...DEFAULT_FILTERS };

	for (const op of vv.operations) {
		switch (op.op) {
			case "cut":
				trimStartSec = op.startSec;
				trimEndSec = op.endSec;
				break;
			case "speed":
				speed *= op.rate;
				break;
			case "crop": {
				const sw = vv.sourceMeta.width ?? 1920;
				const sh = vv.sourceMeta.height ?? 1080;
				const x = Math.round((op.leftPercentage / 100) * sw);
				const y = Math.round((op.topPercentage / 100) * sh);
				const cw = Math.max(1, Math.round((op.widthPercentage / 100) * sw));
				const ch = Math.max(1, Math.round((op.heightPercentage / 100) * sh));
				cropRegion = { x, y, width: cw, height: ch };
				break;
			}
			case "filter":
				if (op.filters.cssFilters) {
					filters = mergeFilters(filters, op.filters.cssFilters);
				}
				break;
			case "flip":
				if (op.horizontal) flipH = !flipH;
				if (op.vertical) flipV = !flipV;
				break;
			case "rotate":
				rotation = (rotation + op.degrees) % 360;
				break;
			// "compose" ops are handled separately (compositor)
		}
	}

	const sourceDurationSec = (vv.sourceMeta.durationMs ?? 0) / 1000;
	const effectiveDurationSec =
		((trimEndSec ?? sourceDurationSec) - trimStartSec) / speed;

	return {
		sourceUrl: resolveVideoSourceUrl(vv),
		trimStartSec,
		trimEndSec,
		speed,
		cropRegion,
		flipH,
		flipV,
		rotation,
		cssFilterString: buildCSSFilterString(filters),
		effectiveDurationSec,
	};
}
