export type MessageRole = "user" | "model" | "system";

// Compatible definitions of OpenAI Agent events
// We redefine them here to avoid adding a dependency on @openai/agents to the shared types package
// Consumers can intersection these with the real types if needed, but the 'type' discriminator matches.

export interface RunRawModelStreamEvent {
	type: "raw_model_stream_event";
	data: {
		type: string;
		delta?: string;
		[key: string]: any;
	};
}

export interface RunItemStreamEvent {
	type: "run_item_stream_event";
	name: string;
	item: any;
}

export interface RunAgentUpdatedStreamEvent {
	type: "agent_updated_stream_event";
	agent: any;
}

// Gatewai Custom Events

export interface GatewaiDoneEvent {
	type: "done";
}

export interface GatewaiErrorEvent {
	type: "error";
	error: string;
}

export interface GatewaiPatchProposedEvent {
	type: "patch_proposed";
	patchId: string;
}

export type GatewaiAgentEvent =
	| RunRawModelStreamEvent
	| RunItemStreamEvent
	| RunAgentUpdatedStreamEvent
	| GatewaiDoneEvent
	| GatewaiErrorEvent
	| GatewaiPatchProposedEvent;
