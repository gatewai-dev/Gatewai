import { type NodeMetadata, NodeMetadataSchema } from "@gatewai/core";
import type { BackendNodePlugin } from "./types.js";

/**
 * Define the shared metadata for a node.
 * This should be used in the `metadata.ts` file of a node package.
 */
export function defineMetadata(metadata: NodeMetadata): Readonly<NodeMetadata> {
	return Object.freeze(NodeMetadataSchema.parse(metadata));
}

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
