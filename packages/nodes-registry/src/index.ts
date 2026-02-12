import type {
	BackendNodePlugin,
	FrontendNodePlugin,
	NodeMetadata,
} from "../../node-sdk/client/ui";

export interface NodePackage {
	metadata: NodeMetadata;
	node: Promise<{ default: BackendNodePlugin }>;
	client: Promise<{ default: FrontendNodePlugin }>;
}

import { metadata as blurMetadata } from "@gatewai/node-blur";
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
};
