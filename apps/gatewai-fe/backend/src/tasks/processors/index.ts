import { NodeType } from "@gatewai/db";
import type {
	FileResult,
	NodeResult,
	VideoCompositorResult,
} from "@gatewai/types";
import audioUnderstandingProcessor from "./audio-understanding.js";
import blurProcessor from "./blur.js";
import compositorProcessor from "./compositor.js";
import cropProcessor from "./crop.js";
import exportProcessor from "./export.js";
import imageGenProcessor from "./image-gen.js";
import llmProcessor from "./llm.js";
import modulateProcessor from "./modulate.js";
import paintProcessor from "./paint.js";
import resizeProcessor from "./resize.js";
import textProcessor from "./text.js";
import textMergerProcessor from "./text-merger.js";
import textToSpeechProcessor from "./text-to-speech.js";
import type { NodeProcessor } from "./types.js";
import videoGenProcessor from "./video-gen.js";
import videoGenExtendProcessor from "./video-gen-extend.js";
import videoGenFirstLastFrameProcessor from "./video-gen-first-last-frame.js";

const nodeProcessors: Partial<Record<NodeType, NodeProcessor>> = {
	[NodeType.Blur]: blurProcessor,
	[NodeType.Resize]: resizeProcessor,
	[NodeType.LLM]: llmProcessor,
	[NodeType.ImageGen]: imageGenProcessor,
	[NodeType.Crop]: cropProcessor,
	[NodeType.Paint]: paintProcessor,
	[NodeType.Modulate]: modulateProcessor,
	[NodeType.Compositor]: compositorProcessor,
	[NodeType.VideoGen]: videoGenProcessor,
	[NodeType.VideoGenExtend]: videoGenExtendProcessor,
	[NodeType.VideoGenFirstLastFrame]: videoGenFirstLastFrameProcessor,

	[NodeType.TextToSpeech]: textToSpeechProcessor,
	[NodeType.SpeechToText]: audioUnderstandingProcessor,
	[NodeType.TextMerger]: textMergerProcessor,
	[NodeType.Export]: exportProcessor,

	[NodeType.Text]: textProcessor,
	[NodeType.File]: async ({ node }) => {
		return { success: true, newResult: node.result as unknown as FileResult };
	},
	// No processing*(not really) needed for below node types
	[NodeType.VideoCompositor]: async ({ node }) => {
		return {
			success: true,
			newResult: node.result as unknown as VideoCompositorResult,
		};
	},
	// Frontend-Process*(not really) only nodes
	// We're adding them here so that they doesn't throw false-positive error for missing processors
	[NodeType.Preview]: async () => {
		return { success: true, result: null };
	},
	[NodeType.Note]: async ({ node }) => {
		return { success: true, newResult: node.result as unknown as NodeResult };
	},
};

export { nodeProcessors };
