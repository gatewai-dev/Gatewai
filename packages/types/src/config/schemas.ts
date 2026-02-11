import { z } from "zod";

// Shared Enums and Constants
export const COMPOSITE_OPERATIONS = [
	// Basic Compositing
	"source-over",
	"source-in",
	"source-out",
	"source-atop",
	"destination-over",
	"destination-in",
	"destination-out",
	"destination-atop",
	"lighter",
	"copy",
	"xor",

	// Blending Modes
	"multiply",
	"screen",
	"overlay",
	"darken",
	"lighten",
	"color-dodge",
	"color-burn",
	"hard-light",
	"soft-light",
	"difference",
	"exclusion",
	"hue",
	"saturation",
	"color",
	"luminosity",
] as const;

export const GlobalCompositeOperation = z.enum(COMPOSITE_OPERATIONS);

// Re-export from nodes if possible, or keep as base
// Since @gatewai/types is a low-level package, it shouldn't import from @gatewai/nodes.
// But node-specific layouts/types can live in nodes.
export const NodeConfigSchema = z.any();

// Keeping only shared primitives if needed, but for now I'll just keep what's left.
