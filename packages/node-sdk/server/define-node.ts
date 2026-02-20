import { type NodeMetadata, NodeMetadataSchema } from "@gatewai/core";
import { defineMetadata } from "../shared/define-node.js";
import type { BackendNodePlugin } from "./types.js";

export { defineMetadata };

/**
 * Define a backend node implementation.
 * This should be used in the `node.ts` file of a node package.
 */
export function defineNode(
	metadata: NodeMetadata,
	plugin: Omit<BackendNodePlugin, keyof NodeMetadata>,
): Readonly<BackendNodePlugin> {
	return Object.freeze({
		...metadata,
		...plugin,
	});
}
