import { type NodeMetadata, NodeMetadataSchema } from "@gatewai/core";

/**
 * Define the shared metadata for a node.
 * This should be used in the `metadata.ts` file of a node package.
 */
export function defineMetadata(metadata: NodeMetadata): Readonly<NodeMetadata> {
	return Object.freeze(NodeMetadataSchema.parse(metadata));
}
