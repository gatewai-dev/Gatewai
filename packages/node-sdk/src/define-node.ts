import { type GatewaiNodeManifest, NodeManifestSchema } from "./types.js";

/**
 * Type-safe factory for defining a Gatewai node manifest.
 *
 * @example
 * ```ts
 * import { defineNode } from "@gatewai/node-sdk";
 *
 * export default defineNode({
 *   type: "Blur",
 *   displayName: "Blur",
 *   category: "Image",
 *   isTerminal: true,
 *   handles: {
 *     inputs: [{ dataTypes: ["Image"], label: "Image", required: true, order: 0 }],
 *     outputs: [{ dataTypes: ["Image"], label: "Output", order: 0 }],
 *   },
 *   backendProcessor: async (ctx) => { ... },
 * });
 * ```
 */
export function defineNode(
	manifest: GatewaiNodeManifest,
): Readonly<GatewaiNodeManifest> {
	// Validate manifest using Zod schema
	const validated = NodeManifestSchema.parse(manifest);

	return Object.freeze(validated);
}
