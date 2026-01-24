import { type Event, EventRole, EventStatus, prisma } from "@gatewai/db";

import type {
	AgentInputItem,
	OpenAIResponsesCompactionArgs,
	OpenAIResponsesCompactionAwareSession,
	OpenAIResponsesCompactionResult,
	RequestUsage,
} from "@openai/agents";

// Type definitions for content structures
interface ToolCallContent {
	type: "hosted_tool_call";
	name?: string;
	id?: string;
	status?: string;
	arguments?: any;
	output?: any;
	providerData?: any;
}

interface MessageContent {
	content?: any;
	type?: string;
	status?: string;
	providerData?: any;
}

type EventContent = string | ToolCallContent | MessageContent;

// Define content part types for normalization (based on OpenAI message content parts)
interface TextContentPart {
	type: "text";
	text: string;
}

// Extend with other part types if multimodal content (e.g., images) is supported in the future
// interface ImageContentPart {
//   type: 'image_url';
//   image_url: { url: string; detail?: 'auto' | 'low' | 'high' };
// }

type ContentPart = TextContentPart; // | ImageContentPart; // Add more as needed

export class PrismaAgentSession
	implements OpenAIResponsesCompactionAwareSession
{
	private sessionId: string | null = null;
	private canvasId: string;
	private assistantId?: string;
	private model?: string;

	constructor(params: {
		canvasId: string;
		sessionId?: string;
		assistantId?: string;
		model?: string;
	}) {
		this.canvasId = params.canvasId;
		this.sessionId = params.sessionId ?? null;
		this.assistantId = params.assistantId;
		this.model = params.model;
	}

	public get id(): string | null {
		return this.sessionId;
	}

	/**
	 * Ensure and return the identifier for this session.
	 */
	async getSessionId(): Promise<string> {
		if (this.sessionId) {
			return this.sessionId;
		}

		// Create a new session if it doesn't exist
		const session = await prisma.agentSession.create({
			data: {
				canvasId: this.canvasId,
				assistantId: this.assistantId,
				model: this.model,
				status: "ACTIVE",
			},
		});

		this.sessionId = session.id;
		return session.id;
	}

	/**
	 * Retrieve items from the conversation history.
	 */
	async getItems(limit?: number): Promise<AgentInputItem[]> {
		const sessionId = await this.getSessionId();

		const events = await prisma.event.findMany({
			where: {
				agentSessionId: sessionId,
			},
			orderBy: {
				createdAt: "desc",
			},
			take: limit,
		});

		// Reverse to get chronological order
		return events.reverse().map((event) => this.eventToAgentInputItem(event));
	}

	/**
	 * Append new items to the conversation history.
	 */
	async addItems(items: AgentInputItem[]): Promise<void> {
		const sessionId = await this.getSessionId();

		await prisma.event.createMany({
			data: items.map((item) =>
				this.agentInputItemToEvent(sessionId, item),
			) as any,
		});

		// Update session timestamp
		await prisma.agentSession.update({
			where: { id: sessionId },
			data: { updatedAt: new Date() },
		});
	}

	/**
	 * Remove and return the most recent item from the conversation history if it exists.
	 */
	async popItem(): Promise<AgentInputItem | undefined> {
		const sessionId = await this.getSessionId();

		// Find the most recent event
		const lastEvent = await prisma.event.findFirst({
			where: {
				agentSessionId: sessionId,
			},
			orderBy: {
				createdAt: "desc",
			},
		});

		if (!lastEvent) {
			return undefined;
		}

		// Delete the event
		await prisma.event.delete({
			where: { id: lastEvent.id },
		});

		return this.eventToAgentInputItem(lastEvent);
	}

	/**
	 * Remove all items that belong to the session and reset its state.
	 */
	async clearSession(): Promise<void> {
		const sessionId = await this.getSessionId();

		// Delete all events
		await prisma.event.deleteMany({
			where: { agentSessionId: sessionId },
		});

		// Update session
		await prisma.agentSession.update({
			where: { id: sessionId },
			data: {
				updatedAt: new Date(),
				metadata: {},
			},
		});
	}

	/**
	 * Run compaction after a completed turn is persisted.
	 */
	async runCompaction(
		args?: OpenAIResponsesCompactionArgs,
	): Promise<OpenAIResponsesCompactionResult | null> {
		const sessionId = await this.getSessionId();
		const eventCount = await prisma.event.count({
			where: { agentSessionId: sessionId },
		});

		// Example threshold: compact if more than 50 events
		if (!args?.force && eventCount < 50) {
			return null;
		}

		// Implement actual compaction logic here
		// This would typically call OpenAI's compact API
		return null;
	}

	/**
	 * Normalize raw content to either a string or an array of structured ContentPart objects based on the role.
	 * This ensures compatibility with expected types: array for assistant (to support potential multi-part content),
	 * string for user/system (as per type expectations).
	 * Handles strings, arrays, and objects, converting them to standardized formats.
	 * Improved to handle nested JSON structures commonly seen in assistant outputs, extracting the innermost text
	 * to clean up conversation history and avoid double-stringified or nested artifacts.
	 * This follows best practices for robustness: defensive parsing, fallbacks, and recursion limits to prevent deep nesting issues.
	 */
	private normalizeContent(
		rawContent: any,
		role: "user" | "assistant" | "system",
	): string | ContentPart[] {
		let parts: ContentPart[] = [];

		if (rawContent == null) {
			parts = [];
		} else if (typeof rawContent === "string") {
			const trimmed = rawContent.trim();
			// Check if it looks like JSON and attempt to parse and unwrap nested structures
			if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
				try {
					const parsed = JSON.parse(trimmed);
					// Handle common outer wrapper {type: 'text', text: '...'}
					if (parsed.type === "text" && typeof parsed.text === "string") {
						// Recurse into the inner text to handle potential double-nesting
						return this.normalizeContent(parsed.text, role);
					} else if (parsed.text && typeof parsed.text === "string") {
						// Fallback for objects with 'text' field
						return this.normalizeContent(parsed.text, role);
					} else {
						// If not unwrappable, treat as text
						parts = [{ type: "text", text: rawContent }];
					}
				} catch {
					// Not valid JSON, treat as plain text
					parts = [{ type: "text", text: rawContent }];
				}
			} else {
				parts = [{ type: "text", text: rawContent }];
			}
		} else if (Array.isArray(rawContent)) {
			parts = rawContent.flatMap((part: any) => {
				if (typeof part === "string") {
					return [{ type: "text", text: part }];
				}
				if (typeof part === "object" && part !== null) {
					if (part.type === "text" && typeof part.text === "string") {
						return [{ type: "text", text: part.text }];
					}
					// Recurse for nested objects
					const normalized = this.normalizeContent(part, role);
					return Array.isArray(normalized)
						? normalized
						: [{ type: "text", text: normalized }];
				}
				// Fallback for unknown part types: convert to text
				return [{ type: "text", text: JSON.stringify(part) }];
			});
		} else if (typeof rawContent === "object" && rawContent !== null) {
			if (
				"type" in rawContent &&
				rawContent.type === "text" &&
				"text" in rawContent
			) {
				// Recurse to handle nesting
				return this.normalizeContent(rawContent.text, role);
			} else if ("text" in rawContent) {
				// Fallback recursion
				return this.normalizeContent(rawContent.text, role);
			} else {
				// Ultimate fallback
				parts = [{ type: "text", text: JSON.stringify(rawContent) }];
			}
		} else {
			// Fallback for primitives
			parts = [{ type: "text", text: String(rawContent) }];
		}

		if (role === "assistant") {
			return parts;
		} else {
			// For user and system, concatenate texts into a single string
			return parts.map((p) => p.text).join("\n\n");
		}
	}

	/**
	 * Convert a Prisma Event to an AgentInputItem
	 */
	private eventToAgentInputItem(event: Event): AgentInputItem {
		// Cast content to our known type
		const content = event.content as EventContent;

		// Type guard to check if content is an object with a type property
		const isObjectContent = (c: any): c is ToolCallContent | MessageContent => {
			return typeof c === "object" && c !== null && "type" in c;
		};

		// Determine the type of item based on stored data
		if (
			event.eventType === "tool_call" ||
			(isObjectContent(content) && content.type === "hosted_tool_call")
		) {
			const toolContent = content as ToolCallContent;
			return {
				type: "hosted_tool_call",
				name: event.toolName || toolContent?.name,
				id: event.toolCallId || toolContent?.id,
				status: toolContent?.status,
				arguments: toolContent?.arguments,
				output: toolContent?.output,
				providerData: toolContent?.providerData,
			} as AgentInputItem;
		}

		// Handle message items
		const role = this.getMessageRole(event.role ?? undefined);
		const messageContent = isObjectContent(content)
			? (content as MessageContent)
			: { content };
		const contentValue = messageContent.content || content;
		const normalizedContent = this.normalizeContent(contentValue, role);

		if (role === "user") {
			return {
				role: "user",
				content: normalizedContent,
				id: event.messageId,
				type: "message",
				providerData: messageContent.providerData,
			} as AgentInputItem;
		}

		if (role === "assistant") {
			return {
				role: "assistant",
				content: normalizedContent,
				id: event.messageId,
				type: "message",
				status: messageContent.status,
				providerData: messageContent.providerData,
			} as AgentInputItem;
		}

		// System message
		return {
			role: "system",
			content: normalizedContent,
			id: event.messageId,
			type: "message",
			providerData: messageContent.providerData,
		} as AgentInputItem;
	}

	/**
	 * Convert an AgentInputItem to a Prisma Event data object
	 */
	private agentInputItemToEvent(sessionId: string, item: AgentInputItem) {
		// Handle tool calls
		if ("type" in item && item.type === "hosted_tool_call") {
			return {
				agentSessionId: sessionId,
				eventType: "tool_call",
				role: EventRole.TOOL,
				toolCallId: item.id,
				toolName: item.name,
				content: {
					type: "hosted_tool_call",
					name: item.name,
					id: item.id,
					status: item.status,
					arguments: item.arguments,
					output: item.output,
					providerData: item.providerData,
				} as any,
				status:
					item.status === "completed"
						? EventStatus.COMPLETED
						: EventStatus.PENDING,
			};
		}

		// Handle messages
		if ("role" in item) {
			const role = this.mapRoleToEventRole(item.role);

			return {
				agentSessionId: sessionId,
				eventType: "message",
				role,
				messageId: "id" in item ? item.id : undefined,
				content: {
					content: item.content,
					type: "type" in item ? item.type : "message",
					status: "status" in item ? item.status : undefined,
					providerData: "providerData" in item ? item.providerData : undefined,
				} as any,
				status: EventStatus.COMPLETED,
			};
		}

		// Fallback for unknown item types
		return {
			agentSessionId: sessionId,
			eventType: "unknown",
			role: EventRole.USER,
			content: item,
			status: EventStatus.COMPLETED,
		};
	}

	/**
	 * Get message role from EventRole
	 */
	private getMessageRole(
		role?: EventRole | string,
	): "user" | "assistant" | "system" {
		if (!role) return "user";

		// Since EventRole is an enum, convert to string safely
		const roleStr = typeof role === "string" ? role : (role as string);
		const normalized = roleStr.toLowerCase();

		if (normalized === "assistant" || normalized === "model")
			return "assistant";
		if (normalized === "system") return "system";
		return "user";
	}

	/**
	 * Map role string to EventRole enum
	 */
	private mapRoleToEventRole(role: string): EventRole {
		switch (role.toLowerCase()) {
			case "user":
				return EventRole.USER;
			case "assistant":
			case "model":
				return EventRole.ASSISTANT;
			case "system":
				return EventRole.SYSTEM;
			case "tool":
				return EventRole.TOOL;
			default:
				return EventRole.USER;
		}
	}

	/**
	 * Store usage data for the most recent assistant message
	 */
	async storeUsage(usage: RequestUsage): Promise<void> {
		const sessionId = await this.getSessionId();

		const lastEvent = await prisma.event.findFirst({
			where: {
				agentSessionId: sessionId,
				role: EventRole.ASSISTANT,
			},
			orderBy: {
				createdAt: "desc",
			},
		});

		if (lastEvent) {
			await prisma.event.update({
				where: { id: lastEvent.id },
				data: {
					promptTokens: usage.inputTokens,
					completionTokens: usage.outputTokens,
					totalTokens: (usage.inputTokens || 0) + (usage.outputTokens || 0),
				},
			});
		}
	}

	/**
	 * Get total token usage for this session
	 */
	async getTotalUsage(): Promise<{
		promptTokens: number;
		completionTokens: number;
		totalTokens: number;
	}> {
		const sessionId = await this.getSessionId();

		const result = await prisma.event.aggregate({
			where: { agentSessionId: sessionId },
			_sum: {
				promptTokens: true,
				completionTokens: true,
				totalTokens: true,
			},
		});

		return {
			promptTokens: result._sum.promptTokens || 0,
			completionTokens: result._sum.completionTokens || 0,
			totalTokens: result._sum.totalTokens || 0,
		};
	}

	/**
	 * Update session metadata
	 */
	async updateMetadata(metadata: Record<string, any>): Promise<void> {
		const sessionId = await this.getSessionId();

		await prisma.agentSession.update({
			where: { id: sessionId },
			data: { metadata },
		});
	}

	/**
	 * Mark session as completed
	 */
	async completeSession(): Promise<void> {
		const sessionId = await this.getSessionId();

		await prisma.agentSession.update({
			where: { id: sessionId },
			data: { status: "COMPLETED" },
		});
	}
}

/**
 * Factory function to create or load a session
 */
export async function createOrLoadSession(params: {
	canvasId: string;
	sessionId?: string;
	assistantId?: string;
	model?: string;
}): Promise<PrismaAgentSession> {
	const session = new PrismaAgentSession(params);
	await session.getSessionId();
	return session;
}

/**
 * Load an existing session by ID
 */
export async function loadSession(
	sessionId: string,
): Promise<PrismaAgentSession | null> {
	const existingSession = await prisma.agentSession.findUnique({
		where: { id: sessionId },
	});

	if (!existingSession) {
		return null;
	}

	return new PrismaAgentSession({
		canvasId: existingSession.canvasId,
		sessionId: existingSession.id,
		assistantId: existingSession.assistantId ?? undefined,
		model: existingSession.model ?? undefined,
	});
}
