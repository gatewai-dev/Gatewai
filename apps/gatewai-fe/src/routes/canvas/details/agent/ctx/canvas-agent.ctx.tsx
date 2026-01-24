import {
	createContext,
	type PropsWithChildren,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState,
} from "react";
import { generateId } from "@/lib/idgen";
import { rpcClient } from "@/rpc/client"; // Assuming rpcClient is imported from the appropriate location
import type { AgentSessionsRPC } from "@/rpc/types";
import { useGetCanvasAgentSessionListQuery } from "@/store/agent-sessions";

const SELECTED_MODEL_STORAGE_KEY = "canvas_agent_selected_model";

export type MessageRole = "user" | "model" | "system";
export interface ChatMessage {
	id: string;
	role: MessageRole;
	text: string;
	isStreaming?: boolean;
	createdAt: Date;
	eventType?: string; // Optional to preserve for potential future use
}

type CanvasAgentContextType = {
	// Session Management
	activeSessionId: string | null;
	setActiveSessionId: (id: string | null) => void;
	createNewSession: () => void;

	// Data
	agentSessionsList: AgentSessionsRPC | undefined;
	isLoadingSessions: boolean;

	// Chat Stream
	messages: ChatMessage[];
	sendMessage: (message: string) => Promise<void>;
	isLoading: boolean;
	stopGeneration: () => void;

	// Patch System
	pendingPatchId: string | null;
	clearPendingPatch: () => void;

	// Model Selection
	selectedModel: string;
	setSelectedModel: (model: string) => void;
};

const CanvasAgentContext = createContext<CanvasAgentContextType | undefined>(
	undefined,
);

function extractText(content: any): string {
	// Handle patch_action events where content is { action, patchId, text }
	if (
		content &&
		typeof content === "object" &&
		typeof content.text === "string" &&
		!content.content
	) {
		return content.text;
	}

	let rawContent = content?.content || content;
	if (Array.isArray(rawContent)) {
		rawContent = rawContent.map((item) => item.text || "").join("\n");
	}

	let text = "";
	if (typeof rawContent === "string") {
		text = rawContent;
		if (text.startsWith("{")) {
			try {
				const parsed = JSON.parse(text);
				if (parsed.type === "text" && parsed.text) {
					const innerParsed = JSON.parse(parsed.text);
					text = innerParsed.text;
				} else if (parsed.text) {
					text = parsed.text;
				}
			} catch (e) {
				// Leave as is if parsing fails
			}
		}
	}
	return text;
}

const CanvasAgentProvider = ({
	children,
	canvasId,
	initialSessionId = null,
}: PropsWithChildren & {
	canvasId: string;
	initialSessionId?: string | null;
}) => {
	const [activeSessionId, setActiveSessionId] = useState<string | null>(
		initialSessionId,
	);
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [pendingPatchId, setPendingPatchId] = useState<string | null>(null);
	const [selectedModel, setSelectedModel] = useState<string>(() => {
		// Check if we're in a browser environment
		if (typeof window !== "undefined") {
			const saved = localStorage.getItem(SELECTED_MODEL_STORAGE_KEY);
			return saved || "gemini-3-flash-preview";
		}
		return "gemini-3-flash-preview";
	});

	useEffect(() => {
		localStorage.setItem(SELECTED_MODEL_STORAGE_KEY, selectedModel);
	}, [selectedModel]);
	const abortControllerRef = useRef<AbortController | null>(null);

	const { data: agentSessionsList, isLoading: isLoadingSessions } =
		useGetCanvasAgentSessionListQuery({
			param: { id: canvasId },
		});

	const createNewSession = useCallback(() => {
		// Abort any ongoing generation
		if (abortControllerRef.current) {
			abortControllerRef.current.abort();
			abortControllerRef.current = null;
		}

		// Generate a client-side ID for immediate UI optimistic updates
		const newId = generateId();

		// Clear messages immediately before setting new session
		setMessages([]);
		setIsLoading(false);
		setActiveSessionId(newId);
	}, []);

	// Automatically select or create session on mount
	useEffect(() => {
		if (isLoadingSessions || activeSessionId) return;

		if (agentSessionsList && agentSessionsList.length > 0) {
			// Sort by createdAt descending and select the latest
			const sortedSessions = [...agentSessionsList].sort(
				(a, b) =>
					new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
			);
			setActiveSessionId(sortedSessions[0].id);
		} else {
			createNewSession();
		}
	}, [isLoadingSessions, agentSessionsList, activeSessionId, createNewSession]);

	const refreshHistory = useCallback(async () => {
		if (!activeSessionId || !canvasId) {
			setMessages([]);
			return;
		}

		setIsLoading(true);
		try {
			const resp = await rpcClient.api.v1.canvas[":id"].agent[
				":sessionId"
			].$get({
				param: { id: canvasId, sessionId: activeSessionId },
			});
			const data = await resp.json();
			if (!data) {
				setMessages([]);
				return;
			}

			const historyMessages = (data.events || [])
				.filter(
					(e) => e.eventType === "message" || e.eventType === "patch_action",
				)
				.map((e: any) => ({
					id: e.id,
					eventType: e.eventType,
					role:
						e.eventType === "patch_action"
							? "system"
							: e.role === "USER"
								? "user"
								: e.role === "ASSISTANT"
									? "model"
									: "system",
					text: extractText(e.content),
					createdAt: new Date(e.createdAt),
				}));
			setMessages(historyMessages);
		} catch (error: unknown) {
			console.error("Error fetching history:", error);
			setMessages([]);
		} finally {
			setIsLoading(false);
		}
	}, [canvasId, activeSessionId]);

	// Fetch history when session changes
	useEffect(() => {
		refreshHistory();
	}, [refreshHistory]);

	const sendMessage = useCallback(
		async (message: string) => {
			if (!message.trim() || !activeSessionId) return;

			const aiMsgId = generateId();
			const userMsg: ChatMessage = {
				id: generateId(),
				role: "user",
				text: message,
				createdAt: new Date(),
			};
			const aiMsg: ChatMessage = {
				id: aiMsgId,
				role: "model",
				text: "",
				isStreaming: true,
				createdAt: new Date(),
			};

			setMessages((prev) => [...prev, userMsg, aiMsg]);
			setIsLoading(true);
			abortControllerRef.current = new AbortController();

			try {
				const response = await rpcClient.api.v1.canvas[":id"].agent[
					":sessionId"
				].$post({
					param: { id: canvasId, sessionId: activeSessionId },
					json: { message, model: selectedModel },
				});

				if (!response.body) throw new Error("No response body");

				const reader = response.body.getReader();
				const decoder = new TextDecoder();
				let aiTextAccumulator = "";
				let buffer = "";

				while (true) {
					const { done, value } = await reader.read();
					if (done) break;
					buffer += decoder.decode(value, { stream: true });

					while (buffer.length > 0) {
						const startIdx = buffer.indexOf("{");
						if (startIdx === -1) {
							buffer = "";
							break;
						}

						let depth = 0;
						let inString = false;
						let endIdx = -1;

						for (let i = startIdx; i < buffer.length; i++) {
							const char = buffer[i];

							if (inString) {
								if (char === "\\") {
									i++;
									continue;
								}
								if (char === '"') {
									inString = false;
								}
							} else {
								if (char === '"') {
									inString = true;
								} else if (char === "{") {
									depth++;
								} else if (char === "}") {
									depth--;
								}
							}

							if (!inString && depth === 0) {
								endIdx = i;
								break;
							}
						}

						if (endIdx === -1) break;

						const jsonStr = buffer.substring(startIdx, endIdx + 1);
						buffer = buffer.substring(endIdx + 1);

						try {
							const event = JSON.parse(jsonStr);

							// Handle patch_proposed events
							if (event.type === "patch_proposed" && event.patchId) {
								setPendingPatchId(event.patchId);
							}

							if (
								event.type === "raw_model_stream_event" &&
								event.data?.type === "output_text_delta"
							) {
								aiTextAccumulator += event.data.delta || "";

								setMessages((prev) =>
									prev.map((msg) =>
										msg.id === aiMsgId
											? { ...msg, text: aiTextAccumulator }
											: msg,
									),
								);
							}
						} catch (e) {
							console.error("Error parsing extracted JSON:", e);
						}
					}
				}
			} catch (error) {
				if (error instanceof Error && error.name !== "AbortError") {
					console.error("Stream error:", error);
				}
			} finally {
				setIsLoading(false);
				setMessages((prev) =>
					prev.map((msg) =>
						msg.id === aiMsgId ? { ...msg, isStreaming: false } : msg,
					),
				);
				abortControllerRef.current = null;
			}
		},
		[canvasId, activeSessionId, selectedModel],
	);

	const stopGeneration = useCallback(() => {
		if (abortControllerRef.current) {
			abortControllerRef.current.abort();
			setIsLoading(false);
		}
	}, []);

	const clearPendingPatch = useCallback(() => {
		setPendingPatchId(null);
		// Refresh history to show the accepted/rejected message
		refreshHistory();
	}, [refreshHistory]);

	return (
		<CanvasAgentContext.Provider
			value={{
				activeSessionId,
				setActiveSessionId,
				createNewSession,
				agentSessionsList,
				isLoadingSessions,
				messages,
				sendMessage,
				isLoading,
				stopGeneration,
				pendingPatchId,
				clearPendingPatch,
				selectedModel,
				setSelectedModel,
			}}
		>
			{children}
		</CanvasAgentContext.Provider>
	);
};

export function useCanvasAgent() {
	const ctx = useContext(CanvasAgentContext);
	if (!ctx) {
		throw new Error("useCanvasAgent must be used inside CanvasAgentProvider");
	}
	return ctx;
}

export { CanvasAgentProvider };
