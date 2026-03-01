import { type NodeMetadata, NodeMetadataSchema } from "@gatewai/core";

/**
 * Define the shared metadata for a node.
 * This should be used in the `metadata.ts` file of a node package.
 */
export function defineMetadata<TMetadata extends NodeMetadata>(
	metadata: TMetadata,
): Readonly<TMetadata> {
	return Object.freeze(NodeMetadataSchema.parse(metadata) as TMetadata);
}
