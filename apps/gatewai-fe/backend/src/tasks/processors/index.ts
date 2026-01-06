import { NodeType } from "@gatewai/db";
import aiAgentProcessor from "./ai-agent/index.js";
import audioUnderstandingProcessor from "./audio-understanding.js";
import blurProcessor from "./blur.js";
import compositorProcessor from "./compositor.js";
import cropProcessor from "./crop.js";
import imageGenProcessor from "./image-gen.js";
import llmProcessor from "./llm.js";
import modulateProcessor from "./modulate.js";
import paintProcessor from "./paint.js";
import resizeProcessor from "./resize.js";
import textToSpeechProcessor from "./text-to-speech.js";
import type { NodeProcessor } from "./types.js";
import videoGenProcessor from "./video-gen.js";
import videoGenExtendProcessor from "./video-gen-extend.js";
import videoGenFirstLastFrameProcessor from "./video-gen-first-last-frame.js";
import videoGenMockProcessor from "./video-gen-mock.js";

const nodeProcessors: Partial<Record<NodeType, NodeProcessor>> = {
	[NodeType.Blur]: blurProcessor,
	[NodeType.Resize]: resizeProcessor,
	[NodeType.LLM]: llmProcessor,
	[NodeType.ImageGen]: imageGenProcessor,
	[NodeType.Agent]: aiAgentProcessor,
	[NodeType.Crop]: cropProcessor,
	[NodeType.Paint]: paintProcessor,
	[NodeType.Modulate]: modulateProcessor,
	[NodeType.Compositor]: compositorProcessor,
	[NodeType.VideoGen]: videoGenProcessor,
	[NodeType.VideoGenExtend]: videoGenMockProcessor,
	[NodeType.VideoGenFirstLastFrame]: videoGenMockProcessor,

	[NodeType.TextToSpeech]: textToSpeechProcessor,
	[NodeType.SpeechToText]: audioUnderstandingProcessor,
	// No processing needed for these node types
	[NodeType.File]: async ({ node }) => {
		return { success: true, result: node.result };
	},
	[NodeType.Export]: async ({ node }) => {
		return { success: true, result: node.result };
	},
	[NodeType.Text]: async ({ node }) => {
		return { success: true, result: node.result };
	},
	[NodeType.Note]: async ({ node }) => {
		return { success: true, result: node.result };
	},
};

export { nodeProcessors };
