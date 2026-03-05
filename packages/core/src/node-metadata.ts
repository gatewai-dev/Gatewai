import z, { type ZodTypeAny } from "zod";
import type { DataType } from "./types/base.js";

const HandleDefinitionSchema = z.object({
	dataTypes: z.custom<DataType[]>(),
	label: z.string(),
	required: z.boolean().optional(),
	order: z.number(),
	description: z.string().optional(),
});

/**
 * Metadata defining the interface and identity of a node.
 * This is safe to import in any environment.
 */
export const NodeMetadataSchema = z.object({
	// Identity
	type: z.string().min(1),

	// User-friendly name for the node, used in the UI. This should be unique across nodes of the same type.
	displayName: z.string().min(1),

	// Short description of the node's functionality, used in the UI and for documentation. Optional.
	description: z.string().optional(),

	// Whether or not to show this node in quick access and sidebar. By default, nodes are shown in both places.
	showInQuickAccess: z.boolean().optional(),

	// Whether or not to show this node in the sidebar. By default, nodes are shown in the sidebar.
	showInSidebar: z.boolean().optional(),

	// The category of the node, used for organizing node templates in the UI on sidebar
	category: z.string().min(1),
	subcategory: z.string().optional(),

	// Default handles for the node. This defines the expected inputs and outputs of the node,
	// along with their data types and other properties.
	// This is used for validation at runtime and for generating the UI for connecting nodes together.
	handles: z.object({
		inputs: z.array(HandleDefinitionSchema),
		outputs: z.array(HandleDefinitionSchema),
	}),

	// Whether or not this node supports variable inputs/outputs of different data types. If enabled, the node can accept or produce different data types on each execution, and the system will validate against the specified data types at runtime.
	variableInputs: z
		.object({
			enabled: z.boolean(),
			dataTypes: z.custom<DataType[]>(),
		})
		.optional(),

	// the same as variableInputs but for outputs.
	// This allows users to define output types for a node. (Can be used for AI agent node)
	variableOutputs: z
		.object({
			enabled: z.boolean(),
			dataTypes: z.custom<DataType[]>(),
		})
		.optional(),

	// Whether or not this is a terminal node (needs to run on server only)
	isTerminal: z.boolean(),
	// Whether or not this node is transient (not stored in DB, only used for execution)
	isTransient: z.boolean().optional(),

	// The config schema used to validate the node's config at runtime. This should be a Zod schema.
	configSchema: z.custom<ZodTypeAny>().optional(),
	// Default config values for the node. This should match the shape of the config schema.
	defaultConfig: z.record(z.unknown()).optional(),

	// The pricing function - takes config as parameter and returns a number representing the cost of executing the node with that config. This is used for cost estimation and tracking.
	pricing: z.any().optional(),

	// The result schema of the node's execution. This is used to validate the output of the node at runtime. This should be a Zod schema.
	resultSchema: z.custom<ZodTypeAny>().optional(),
});

export type NodeMetadata<TConfig = any> = Omit<
	z.infer<typeof NodeMetadataSchema>,
	"pricing"
> & {
	pricing?: (config: TConfig) => number;
};
