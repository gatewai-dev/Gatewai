import type { ExtendedLayer } from "@gatewai/core/types";

// ── Timing & FPS ────────────────────────────────────────────────────────────

export const DEFAULT_FPS = 30;
export const DEFAULT_DURATION_MS = 5000;

// ── Dimension fallback for visual media without metadata ────────────────────

export const DEFAULT_MEDIA_DIMENSION = 400;

// ── Per-type layer defaults ─────────────────────────────────────────────────

/** Default styling applied to new Text layers. */
export const TEXT_LAYER_DEFAULTS: Partial<ExtendedLayer> = {
	fontSize: 60,
	fontFamily: "Inter",
	fill: "#ffffff",
	fontStyle: "normal",
	textDecoration: "",
	align: "left",
	padding: 0,
};

/** Default styling applied to new Caption layers. */
export const CAPTION_LAYER_DEFAULTS: Partial<ExtendedLayer> = {
	fontSize: 48,
	fontFamily: "Inter",
	fill: "#ffffff",
	align: "center",
	verticalAlign: "bottom",
	padding: 0,
	lineHeight: 1.2,
};

/** Default properties for Lottie layers. */
export const LOTTIE_LAYER_DEFAULTS: Partial<ExtendedLayer> = {
	lottieLoop: true,
	speed: 1,
};
