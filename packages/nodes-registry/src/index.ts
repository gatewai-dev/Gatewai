import type { FrontendNodePlugin } from "@gatewai/node-sdk/browser";
import type { BackendNodePlugin, NodeMetadata } from "@gatewai/node-sdk/server";

export interface NodePackage {
	metadata: NodeMetadata;
	node: Promise<{ default: BackendNodePlugin }>;
	client: Promise<{ default: FrontendNodePlugin }>;
}

import { metadata as blurMetadata } from "@gatewai/node-blur";
import { manifest as imageCompositorMetadata } from "@gatewai/node-image-compositor";
import { metadata as textMetadata } from "@gatewai/node-text";

export const registeredNodes: Record<string, NodePackage> = {
	blur: {
		metadata: blurMetadata,
		node: import("@gatewai/node-blur/node"),
		client: import("@gatewai/node-blur/client"),
	},
	text: {
		metadata: textMetadata,
		node: import("@gatewai/node-text/node"),
		client: import("@gatewai/node-text/client"),
	},
	"image-compositor": {
		metadata: imageCompositorMetadata,
		node: import("@gatewai/node-image-compositor/server"),
		client: import("@gatewai/node-image-compositor/browser"),
	},
};
