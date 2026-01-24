import {
	createContext,
	type PropsWithChildren,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState,
} from "react";
import type { AgentSessionsRPC } from "@/rpc/types";
import { useGetCanvasAgentSessionListQuery } from "@/store/agent-sessions";

export type MessageRole = "user" | "model" | "system";
export interface ChatMessage {
	id: string;
	role: MessageRole;
	text: string;
	isStreaming?: boolean;
	createdAt: Date;
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
};

const CanvasAgentContext = createContext<CanvasAgentContextType | undefined>(
	undefined,
);

function extractText(content: any): string {
	let rawContent = content.content;
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
	const abortControllerRef = useRef<AbortController | null>(null);

	const { data: agentSessionsList, isLoading: isLoadingSessions } =
		useGetCanvasAgentSessionListQuery({
			param: { id: canvasId },
		});

	// Fetch history when session changes
	useEffect(() => {
		if (!activeSessionId || !canvasId) {
			setMessages([]);
			return;
		}

		const fetchHistory = async () => {
			setIsLoading(true);
			try {
				const res = await fetch(
					`/api/v1/canvas/${canvasId}/agent/${activeSessionId}`,
				);
				if (!res.ok) {
					// New session - no history yet
					if (res.status === 404) {
						setMessages([]);
						return;
					}
					throw new Error("Failed to fetch session");
				}
				const data = await res.json();
				const historyMessages = (data.events || [])
					.filter((e: any) => e.eventType === "message")
					.map((e: any) => ({
						id: e.id,
						role:
							e.role === "USER"
								? "user"
								: e.role === "ASSISTANT"
									? "model"
									: "system",
						text: extractText(e.content),
						createdAt: new Date(e.createdAt),
					}));
				setMessages(historyMessages);
			} catch (error) {
				console.error("Error fetching history:", error);
				setMessages([]);
			} finally {
				setIsLoading(false);
			}
		};

		fetchHistory();
	}, [canvasId, activeSessionId]);

	const createNewSession = useCallback(() => {
		// Abort any ongoing generation
		if (abortControllerRef.current) {
			abortControllerRef.current.abort();
			abortControllerRef.current = null;
		}

		// Generate a client-side ID for immediate UI optimistic updates
		const newId = crypto.randomUUID();

		// Clear messages immediately before setting new session
		setMessages([]);
		setIsLoading(false);
		setActiveSessionId(newId);
	}, []);

	const sendMessage = useCallback(
		async (message: string) => {
			if (!message.trim() || !activeSessionId) return;

			const aiMsgId = crypto.randomUUID();
			const userMsg: ChatMessage = {
				id: crypto.randomUUID(),
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
				const response = await fetch(
					`/api/v1/canvas/${canvasId}/agent/${activeSessionId}`,
					{
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ message }),
						signal: abortControllerRef.current.signal,
					},
				);

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
		[canvasId, activeSessionId],
	);

	const stopGeneration = useCallback(() => {
		if (abortControllerRef.current) {
			abortControllerRef.current.abort();
			setIsLoading(false);
		}
	}, []);

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
