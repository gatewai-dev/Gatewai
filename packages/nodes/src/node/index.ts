import type { GatewaiNodeManifest } from "@gatewai/node-sdk";
// ── Image Processing ─────────────────────────────────────────────────────────
import blurNode from "./blur/manifest.js";
import compositorNode from "./compositor/manifest.js";
import cropNode from "./crop/manifest.js";
import exportNode from "./export/manifest.js";
import fileNode from "./file/manifest.js";
import imageGenNode from "./image-gen/manifest.js";
// ── AI Nodes ─────────────────────────────────────────────────────────────────
import llmNode from "./llm/manifest.js";
import modulateNode from "./modulate/manifest.js";
import noteNode from "./note/manifest.js";
import paintNode from "./paint/manifest.js";
// ── Output Nodes ─────────────────────────────────────────────────────────────
import previewNode from "./preview/manifest.js";
import resizeNode from "./resize/manifest.js";
import speechToTextNode from "./speech-to-text/manifest.js";
// ── Input Nodes ──────────────────────────────────────────────────────────────
import textNode from "./text/manifest.js";
// ── Tools ────────────────────────────────────────────────────────────────────
import textMergerNode from "./text-merger/manifest.js";
import textToSpeechNode from "./text-to-speech/manifest.js";
// ── Video ────────────────────────────────────────────────────────────────────
import videoCompositorNode from "./video-compositor/manifest.js";
import videoGenNode from "./video-gen/manifest.js";
import videoGenFirstLastFrameNode from "./video-gen-first-last-frame/manifest.js";

/**
 * All built-in node manifests, exported as an array.
 * Used by the core engine to register built-in nodes at startup.
 */
export const builtinNodes: readonly GatewaiNodeManifest[] = [
	// Inputs
	textNode,
	fileNode,

	// Outputs
	previewNode,
	exportNode,

	// Image Processing
	blurNode,
	cropNode,
	resizeNode,
	modulateNode,
	paintNode,
	compositorNode,

	// AI
	llmNode,
	imageGenNode,
	videoGenNode,
	videoGenFirstLastFrameNode,
	textToSpeechNode,
	speechToTextNode,

	// Tools
	textMergerNode,
	noteNode,

	// Video
	videoCompositorNode,
] as const;

/**
 * Lookup a built-in node manifest by type.
 */
export function getBuiltinNode(type: string): GatewaiNodeManifest | undefined {
	return builtinNodes.find((n) => n.type === type);
}

/**
 * Map of built-in node manifests keyed by their type string.
 */
export const builtinNodeMap: ReadonlyMap<string, GatewaiNodeManifest> = new Map(
	builtinNodes.map((n) => [n.type, n]),
);

// Re-export individual manifests for direct import
export {
	textNode,
	fileNode,
	previewNode,
	exportNode,
	blurNode,
	cropNode,
	resizeNode,
	modulateNode,
	paintNode,
	compositorNode,
	llmNode,
	imageGenNode,
	videoGenNode,
	videoGenFirstLastFrameNode,
	textToSpeechNode,
	speechToTextNode,
	textMergerNode,
	noteNode,
	videoCompositorNode,
};
