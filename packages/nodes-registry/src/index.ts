import type { FrontendNodePlugin } from "@gatewai/node-sdk/browser";
import type { BackendNodePlugin, NodeMetadata } from "@gatewai/node-sdk/server";

export interface NodePackage {
	metadata: NodeMetadata;
	node: Promise<{ default: BackendNodePlugin }>;
	client: Promise<{ default: FrontendNodePlugin }>;
}

// Existing standalone packages
import { metadata as blurMetadata } from "@gatewai/node-blur";
// New standalone packages
import cropMetadata from "@gatewai/node-crop";
import exportMetadata from "@gatewai/node-export";
import { manifest as imageCompositorMetadata } from "@gatewai/node-image-compositor";
import imageGenMetadata from "@gatewai/node-image-gen";
import fileMetadata from "@gatewai/node-import";
import llmMetadata from "@gatewai/node-llm";
import modulateMetadata from "@gatewai/node-modulate";
import noteMetadata from "@gatewai/node-note";
import paintMetadata from "@gatewai/node-paint";
import previewMetadata from "@gatewai/node-preview";
import resizeMetadata from "@gatewai/node-resize";
import speechToTextMetadata from "@gatewai/node-speech-to-text";
import { metadata as textMetadata } from "@gatewai/node-text";
import textMergerMetadata from "@gatewai/node-text-merger";
import textToSpeechMetadata from "@gatewai/node-text-to-speech";
import { manifest as videoCompositorMetadata } from "@gatewai/node-video-compositor";
import videoGenMetadata from "@gatewai/node-video-gen";
import videoGenFirstLastFrameMetadata from "@gatewai/node-video-gen-first-last-frame";

export const registeredNodes: Record<string, NodePackage> = {
	blur: {
		metadata: blurMetadata,
		node: import("@gatewai/node-blur/server"),
		client: import("@gatewai/node-blur/browser"),
	},
	text: {
		metadata: textMetadata,
		node: import("@gatewai/node-text/server"),
		client: import("@gatewai/node-text/browser"),
	},
	"image-compositor": {
		metadata: imageCompositorMetadata,
		node: import("@gatewai/node-image-compositor/server"),
		client: import("@gatewai/node-image-compositor/browser"),
	},
	"video-compositor": {
		metadata: videoCompositorMetadata,
		node: import("@gatewai/node-video-compositor/server"),
		client: import("@gatewai/node-video-compositor/browser"),
	},
	crop: {
		metadata: cropMetadata,
		node: import("@gatewai/node-crop/server"),
		client: import("@gatewai/node-crop/browser"),
	},
	resize: {
		metadata: resizeMetadata,
		node: import("@gatewai/node-resize/server"),
		client: import("@gatewai/node-resize/browser"),
	},
	modulate: {
		metadata: modulateMetadata,
		node: import("@gatewai/node-modulate/server"),
		client: import("@gatewai/node-modulate/browser"),
	},
	paint: {
		metadata: paintMetadata,
		node: import("@gatewai/node-paint/server"),
		client: import("@gatewai/node-paint/browser"),
	},
	export: {
		metadata: exportMetadata,
		node: import("@gatewai/node-export/server"),
		client: import("@gatewai/node-export/browser"),
	},
	file: {
		metadata: fileMetadata,
		node: import("@gatewai/node-import/server"),
		client: import("@gatewai/node-import/browser"),
	},
	preview: {
		metadata: previewMetadata,
		node: import("@gatewai/node-preview/server"),
		client: import("@gatewai/node-preview/browser"),
	},
	note: {
		metadata: noteMetadata,
		node: import("@gatewai/node-note/server"),
		client: import("@gatewai/node-note/browser"),
	},
	llm: {
		metadata: llmMetadata,
		node: import("@gatewai/node-llm/server"),
		client: import("@gatewai/node-llm/browser"),
	},
	"image-gen": {
		metadata: imageGenMetadata,
		node: import("@gatewai/node-image-gen/server"),
		client: import("@gatewai/node-image-gen/browser"),
	},
	"video-gen": {
		metadata: videoGenMetadata,
		node: import("@gatewai/node-video-gen/server"),
		client: import("@gatewai/node-video-gen/browser"),
	},
	"video-gen-first-last-frame": {
		metadata: videoGenFirstLastFrameMetadata,
		node: import("@gatewai/node-video-gen-first-last-frame/server"),
		client: import("@gatewai/node-video-gen-first-last-frame/browser"),
	},
	"text-merger": {
		metadata: textMergerMetadata,
		node: import("@gatewai/node-text-merger/server"),
		client: import("@gatewai/node-text-merger/browser"),
	},
	"text-to-speech": {
		metadata: textToSpeechMetadata,
		node: import("@gatewai/node-text-to-speech/server"),
		client: import("@gatewai/node-text-to-speech/browser"),
	},
	"speech-to-text": {
		metadata: speechToTextMetadata,
		node: import("@gatewai/node-speech-to-text/server"),
		client: import("@gatewai/node-speech-to-text/browser"),
	},
};
