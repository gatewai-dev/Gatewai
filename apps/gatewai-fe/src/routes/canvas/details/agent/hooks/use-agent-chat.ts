import { useCallback, useEffect, useRef, useState } from "react";

export type MessageRole = "user" | "model" | "system";
export interface ChatMessage {
	id: string;
	role: MessageRole;
	text: string;
	isStreaming?: boolean;
	createdAt: Date;
}

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

export function useAgentChatStream(canvasId: string, sessionId: string) {
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [pendingPatchId, setPendingPatchId] = useState<string | null>(null);
	const abortControllerRef = useRef<AbortController | null>(null);

	// --- Fetch History ---
	useEffect(() => {
		if (!sessionId || !canvasId) {
			setMessages([]);
			return;
		}

		const fetchHistory = async () => {
			setIsLoading(true);
			try {
				const res = await fetch(
					`/api/v1/canvas/${canvasId}/agent/${sessionId}`,
				);
				if (!res.ok) throw new Error("Failed to fetch session");
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
			} finally {
				setIsLoading(false);
			}
		};

		fetchHistory();
	}, [canvasId, sessionId]);

	const sendMessage = useCallback(
		async (message: string) => {
			if (!message.trim() || !sessionId) return;

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
					`/api/v1/canvas/${canvasId}/agent/${sessionId}`,
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
				let buffer = ""; // Buffer to handle partial or concatenated JSON

				while (true) {
					const { done, value } = await reader.read();
					if (done) break;
					buffer += decoder.decode(value, { stream: true });

					// Robust parsing: find matching curly braces, skipping strings
					while (buffer.length > 0) {
						const startIdx = buffer.indexOf("{");
						if (startIdx === -1) {
							buffer = ""; // No more objects
							break;
						}

						let depth = 0;
						let inString = false;
						let endIdx = -1;

						for (let i = startIdx; i < buffer.length; i++) {
							const char = buffer[i];

							if (inString) {
								if (char === "\\") {
									i++; // Skip the escaped character
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

						// If we didn't find a closing brace, wait for more data
						if (endIdx === -1) break;

						const jsonStr = buffer.substring(startIdx, endIdx + 1);
						buffer = buffer.substring(endIdx + 1);

						try {
							const event = JSON.parse(jsonStr);

							// Handle patch_proposed events
							if (event.type === "patch_proposed" && event.patchId) {
								setPendingPatchId(event.patchId);
							}

							// Extract text from 'output_text_delta'
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
		[canvasId, sessionId],
	);

	const stopGeneration = useCallback(() => {
		if (abortControllerRef.current) {
			abortControllerRef.current.abort();
			setIsLoading(false);
		}
	}, []);

	const clearPendingPatch = useCallback(() => {
		setPendingPatchId(null);
	}, []);

	return {
		messages,
		sendMessage,
		isLoading,
		stopGeneration,
		setMessages,
		pendingPatchId,
		clearPendingPatch,
	};
}
