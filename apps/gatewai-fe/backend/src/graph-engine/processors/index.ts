import { nodeRegistry } from "@gatewai/graph-engine";
import {
	blurNode,
	compositorNode,
	cropNode,
	exportNode,
	imageGenNode,
	llmNode,
	modulateNode,
	paintNode,
	resizeNode,
	speechToTextNode,
	textMergerNode,
	textNode,
	textToSpeechNode,
	videoGenFirstLastFrameNode,
	videoGenNode,
} from "@gatewai/nodes/node";
import type {
	FileResult,
	NodeResult,
	VideoCompositorResult,
} from "@gatewai/types";
import type { NodeProcessorCtx } from "./types.js";

// ────────────────────────────────────────────────────────────────────────────
// Register backend processors into the NodeRegistry.
//
// The manifests from @gatewai/nodes define the node metadata and the
// backendProcessor function which contains the execution logic.
// ────────────────────────────────────────────────────────────────────────────

if (blurNode.backendProcessor) {
	nodeRegistry.registerProcessor(blurNode.type, blurNode.backendProcessor);
}
if (resizeNode.backendProcessor) {
	nodeRegistry.registerProcessor(resizeNode.type, resizeNode.backendProcessor);
}
if (llmNode.backendProcessor) {
	nodeRegistry.registerProcessor(llmNode.type, llmNode.backendProcessor);
}
if (imageGenNode.backendProcessor) {
	nodeRegistry.registerProcessor(
		imageGenNode.type,
		imageGenNode.backendProcessor,
	);
}
if (cropNode.backendProcessor) {
	nodeRegistry.registerProcessor(cropNode.type, cropNode.backendProcessor);
}
if (paintNode.backendProcessor) {
	nodeRegistry.registerProcessor(paintNode.type, paintNode.backendProcessor);
}
if (modulateNode.backendProcessor) {
	nodeRegistry.registerProcessor(
		modulateNode.type,
		modulateNode.backendProcessor,
	);
}
if (compositorNode.backendProcessor) {
	nodeRegistry.registerProcessor(
		compositorNode.type,
		compositorNode.backendProcessor,
	);
}

// Video Gen
if (videoGenNode.backendProcessor) {
	nodeRegistry.registerProcessor(
		videoGenNode.type,
		videoGenNode.backendProcessor,
	);
}
if (videoGenFirstLastFrameNode.backendProcessor) {
	nodeRegistry.registerProcessor(
		videoGenFirstLastFrameNode.type,
		videoGenFirstLastFrameNode.backendProcessor,
	);
}

// Audio / Text
if (textToSpeechNode.backendProcessor) {
	nodeRegistry.registerProcessor(
		textToSpeechNode.type,
		textToSpeechNode.backendProcessor,
	);
}
if (speechToTextNode.backendProcessor) {
	nodeRegistry.registerProcessor(
		speechToTextNode.type,
		speechToTextNode.backendProcessor,
	);
}
if (textMergerNode.backendProcessor) {
	nodeRegistry.registerProcessor(
		textMergerNode.type,
		textMergerNode.backendProcessor,
	);
}
if (exportNode.backendProcessor) {
	nodeRegistry.registerProcessor(exportNode.type, exportNode.backendProcessor);
}
if (textNode.backendProcessor) {
	nodeRegistry.registerProcessor(textNode.type, textNode.backendProcessor);
}

// Passthrough processors for nodes that don't need backend processing
nodeRegistry.registerProcessor("File", async ({ node }: NodeProcessorCtx) => {
	return { success: true, newResult: node.result as unknown as FileResult };
});
nodeRegistry.registerProcessor(
	"VideoCompositor",
	async ({ node }: NodeProcessorCtx) => {
		return {
			success: true,
			newResult: node.result as unknown as VideoCompositorResult,
		};
	},
);
nodeRegistry.registerProcessor("Preview", async () => {
	return { success: true, result: null };
});
nodeRegistry.registerProcessor("Note", async ({ node }: NodeProcessorCtx) => {
	return { success: true, newResult: node.result as unknown as NodeResult };
});

export { nodeRegistry };
