import type {
	BackendNodePlugin,
	FrontendNodePlugin,
	NodeMetadata,
} from "./sdk/server/index.js";

export interface NodePackage {
	metadata: NodeMetadata;
	node: Promise<{ default: BackendNodePlugin }>;
	client: Promise<{ default: FrontendNodePlugin }>;
}

import { metadata as blurMetadata } from "./blur/metadata.js";
import { manifest as imageCompositorMetadata } from "./image-compositor/metadata.js";
import { metadata as textMetadata } from "./text/metadata.js";
import { manifest as videoCompositorMetadata } from "./video-compositor/metadata.js";

export const registeredNodes: Record<string, NodePackage> = {
	blur: {
		metadata: blurMetadata,
		node: import("./blur/server/index.js"),
		client: import("./blur/browser/index.js"),
	},
	text: {
		metadata: textMetadata,
		node: import("./text/server/index.js"),
		client: import("./text/browser/index.js"),
	},
	"image-compositor": {
		metadata: imageCompositorMetadata,
		node: import("./image-compositor/server/index.js"),
		client: import("./image-compositor/browser/index.js"),
	},
	"video-compositor": {
		metadata: videoCompositorMetadata,
		node: import("./video-compositor/server/index.js"),
		client: import("./video-compositor/browser/index.js"),
	},
};
