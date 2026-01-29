import { useCallback, useEffect, useRef, useState } from "react";
import { generateId } from "@/lib/idgen";
import { rpcClient } from "@/rpc/client";

export type MessageRole = "user" | "model" | "system";
export type MessageType =
	| "message"
	| "function_call"
	| "function_call_result"
	| "tool_call"
	| "patch_proposed"
	| "patch_action";

export interface ChatMessage {
	id: string;
	role: MessageRole;
	text: string;
	isStreaming?: boolean;
	eventType?: string;
	messageType?: MessageType;
	patchId?: string;
	patchStatus?: "PENDING" | "ACCEPTED" | "REJECTED";
	createdAt: Date;
}

export function useAgentChatStream(
	canvasId: string,
	sessionId: string,
	model: string,
) {
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [isRequestPending, setIsRequestPending] = useState(false);
	const [pendingPatchId, setPendingPatchId] = useState<string | null>(null);
	const abortControllerRef = useRef<AbortController | null>(null);

	const connectToStream = useCallback(async () => {
		if (abortControllerRef.current) {
			abortControllerRef.current.abort();
		}
		abortControllerRef.current = new AbortController();

		// Note: We do NOT set isRequestPending(true) here.
		// Connecting to the stream is a background process (listening).
		// We rely on message.isStreaming state to determine if the UI should show a "busy" state.

		try {
			const res = await rpcClient.api.v1.canvas[":id"].agent[
				":sessionId"
			].stream.$get(
				{
					param: { id: canvasId, sessionId },
				},
				{
					init: {
						signal: abortControllerRef.current.signal,
					},
				},
			);

			if (!res.body) return;

			const reader = res.body.getReader();
			const decoder = new TextDecoder();
			let aiTextAccumulator = "";
			let currentAiMsgId: string | null = null;

			// Initialize from existing streaming message if present (e.g. after refresh)
			setMessages((prev) => {
				const lastMsg = prev[prev.length - 1];
				if (lastMsg && lastMsg.role === "model" && lastMsg.isStreaming) {
					aiTextAccumulator = lastMsg.text;
					currentAiMsgId = lastMsg.id;
				}
				return prev;
			});

			let buffer = "";

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				buffer += decoder.decode(value, { stream: true });

				const lines = buffer.split("\n");
				buffer = lines.pop() || "";

				for (const line of lines) {
					if (line.trim() === "") continue;
					if (line.startsWith("data: ")) {
						const jsonStr = line.slice(6);
						try {
							const event = JSON.parse(jsonStr);

							if (event.type === "done") {
								break;
							}

							if (event.type === "error") {
								console.error("Agent error:", event.error);
								break;
							}

							if (event.type === "patch_proposed" && event.patchId) {
								setPendingPatchId(event.patchId);
							}

							if (
								event.type === "raw_model_stream_event" &&
								event.data?.type === "output_text_delta"
							) {
								const delta = event.data.delta || "";
								aiTextAccumulator += delta;

								setMessages((prev) => {
									const lastMsg = prev[prev.length - 1];
									if (
										lastMsg &&
										lastMsg.role === "model" &&
										lastMsg.isStreaming
									) {
										currentAiMsgId = lastMsg.id;
										return prev.map((msg) =>
											msg.id === lastMsg.id
												? { ...msg, text: aiTextAccumulator }
												: msg,
										);
									} else if (currentAiMsgId) {
										return prev.map((msg) =>
											msg.id === currentAiMsgId
												? { ...msg, text: aiTextAccumulator }
												: msg,
										);
									} else {
										const newId = generateId();
										currentAiMsgId = newId;
										return [
											...prev,
											{
												id: newId,
												role: "model",
												text: aiTextAccumulator,
												isStreaming: true,
												createdAt: new Date(),
											},
										];
									}
								});
							}
						} catch (e) {
							console.error("Error parsing SSE JSON:", e);
						}
					}
				}
			}
		} catch (error) {
			if (error instanceof Error && error.name !== "AbortError") {
				console.error("Stream error:", error);
			}
		} finally {
			setMessages((prev) =>
				prev.map((msg) => ({ ...msg, isStreaming: false })),
			);
			abortControllerRef.current = null;
		}
	}, [canvasId, sessionId]);

	// --- Fetch History & Reconnect Stream ---
	useEffect(() => {
		// Clear messages immediately when sessionId changes
		setMessages([]);

		if (!sessionId || !canvasId) {
			setIsRequestPending(false); // Ensure we reset if no session
			return;
		}
		const fetchHistoryAndConnect = async () => {
			setIsRequestPending(true);
			try {
				const res = await rpcClient.api.v1.canvas[":id"].agent[
					":sessionId"
				].$get({
					param: { id: canvasId, sessionId },
				});
				if (!res.ok) throw new Error("Failed to fetch session");
				const data = await res.json();

				const historyMessages = (data.messages || []).map((m: any) => ({
					...m,
					createdAt: new Date(m.createdAt),
				}));
				setMessages(historyMessages);

				// History loaded, stop "Loading" spinner immediately
				setIsRequestPending(false);

				// If session is active, connect to stream (background)
				if (data.status === "ACTIVE") {
					connectToStream();
				}

				// Check for pending patch in history
				const lastPatchMsg = [...historyMessages]
					.reverse()
					.find((m) => m.eventType === "patch_proposed" && m.patchId);
				if (lastPatchMsg?.patchStatus === "PENDING" && lastPatchMsg.patchId) {
					setPendingPatchId(lastPatchMsg.patchId);
				}
			} catch (error) {
				console.error("Error fetching history:", error);
				setIsRequestPending(false);
			}
		};

		fetchHistoryAndConnect();
	}, [canvasId, sessionId, connectToStream]);

	const sendMessage = useCallback(
		async (message: string) => {
			if (!message.trim() || !sessionId) return;

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
			setIsRequestPending(true);
			abortControllerRef.current = new AbortController();

			try {
				const response = await rpcClient.api.v1.canvas[":id"].agent[
					":sessionId"
				].$post(
					{
						param: { id: canvasId, sessionId },
						json: { message, model }, // Use the model passed to the hook
					},
					{
						init: {
							signal: abortControllerRef.current.signal,
						},
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

					const lines = buffer.split("\n");
					buffer = lines.pop() || "";

					for (const line of lines) {
						if (line.trim() === "") continue;
						if (line.startsWith("data: ")) {
							const jsonStr = line.slice(6);
							try {
								const event = JSON.parse(jsonStr);

								if (event.type === "done") {
									break;
								}

								if (event.type === "error") {
									console.error("Agent error:", event.error);
									break;
								}

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
								console.error("Error parsing SSE JSON:", e);
							}
						}
					}
				}
			} catch (error) {
				if (error instanceof Error && error.name !== "AbortError") {
					console.error("Stream error:", error);
				}
			} finally {
				setIsRequestPending(false);
				setMessages((prev) =>
					prev.map((msg) =>
						msg.id === aiMsgId ? { ...msg, isStreaming: false } : msg,
					),
				);
				abortControllerRef.current = null;
			}
		},
		[canvasId, sessionId, model],
	);

	const stopGeneration = useCallback(async () => {
		if (abortControllerRef.current) {
			abortControllerRef.current.abort();
		}
		if (sessionId && canvasId) {
			try {
				await rpcClient.api.v1.canvas[":id"].agent[":sessionId"].stop.$post({
					param: { id: canvasId, sessionId },
				});
			} catch (e) {
				console.error("Failed to stop generation on backend", e);
			}
		}
		setIsRequestPending(false);
	}, [canvasId, sessionId]);

	const clearPendingPatch = useCallback(() => {
		setPendingPatchId(null);
	}, []);

	// The UI is "loading" if we are waiting for a request OR if a message is actively streaming
	const isStreaming = messages.some((m) => m.isStreaming && m.role === "model");
	const isLoading = isRequestPending || isStreaming;

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
