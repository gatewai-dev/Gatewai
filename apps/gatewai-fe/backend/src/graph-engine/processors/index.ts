import { nodeRegistry } from "@gatewai/graph-engine";
import { blurNode } from "@gatewai/node-blur/server";
import { cropNode } from "@gatewai/node-crop/server";
import { exportNode } from "@gatewai/node-export/server";
import { fileNode } from "@gatewai/node-file/server";
import { compositorNode } from "@gatewai/node-image-compositor/server";
import { imageGenNode } from "@gatewai/node-image-gen/server";
import { llmNode } from "@gatewai/node-llm/server";
import { modulateNode } from "@gatewai/node-modulate/server";
import { noteNode } from "@gatewai/node-note/server";
import { paintNode } from "@gatewai/node-paint/server";
import { previewNode } from "@gatewai/node-preview/server";
import { resizeNode } from "@gatewai/node-resize/server";
import { speechToTextNode } from "@gatewai/node-speech-to-text/server";
import { textNode } from "@gatewai/node-text/server";
import { textMergerNode } from "@gatewai/node-text-merger/server";
import { textToSpeechNode } from "@gatewai/node-text-to-speech/server";
import { videoCompositorNode } from "@gatewai/node-video-compositor/server";
import { videoGenNode } from "@gatewai/node-video-gen/server";
import { videoGenFirstLastFrameNode } from "@gatewai/node-video-gen-first-last-frame/server";

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
if (fileNode.backendProcessor) {
	nodeRegistry.registerProcessor(fileNode.type, fileNode.backendProcessor);
}
if (videoCompositorNode.backendProcessor) {
	nodeRegistry.registerProcessor(
		videoCompositorNode.type,
		videoCompositorNode.backendProcessor,
	);
}
if (previewNode.backendProcessor) {
	nodeRegistry.registerProcessor(
		previewNode.type,
		previewNode.backendProcessor,
	);
}
if (noteNode.backendProcessor) {
	nodeRegistry.registerProcessor(noteNode.type, noteNode.backendProcessor);
}

// ─── Registration End ────────────────────────────────────────────────────────

export { nodeRegistry };
