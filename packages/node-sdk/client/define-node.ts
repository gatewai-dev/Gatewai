import type { NodeMetadata } from "@gatewai/core";
import type { FrontendNodePlugin } from "./types.js";

/**
 * Define a frontend node implementation.
 * This should be used in the `client.tsx` file of a node package.
 */
export function defineClient(
	metadata: NodeMetadata,
	plugin: Omit<FrontendNodePlugin, keyof NodeMetadata>,
): Readonly<FrontendNodePlugin> {
	return Object.freeze({
		...metadata,
		...plugin,
	});
}
