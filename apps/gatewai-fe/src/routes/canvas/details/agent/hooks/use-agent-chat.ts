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
	const [isLoading, setIsLoading] = useState(false);
	const [pendingPatchId, setPendingPatchId] = useState<string | null>(null);
	const abortControllerRef = useRef<AbortController | null>(null);

	const connectToStream = useCallback(async () => {
		if (abortControllerRef.current) {
			abortControllerRef.current.abort();
		}
		abortControllerRef.current = new AbortController();
		setIsLoading(true);

		try {
			// rpcClient doesn't support streaming response body directly with type inference for the stream content
			// but we can get the raw response.
			// The path is /api/v1/canvas/:id/agent/:sessionId/stream
			// We need to verify if this route is available in the typed client.
			// If not, we might need to use fetch or cast the client.
			// Assuming it is available or we use the path directly if not.
			// Since we just added it to the backend, the types might not be updated in the frontend if they are generated.
			// But usually Hono types are inferred from the backend source if imported.

			// Let's try to use rpcClient if possible, otherwise fallback to fetch with correct base URL logic if needed.
			// But wait, rpcClient is configured with base URL.
			// If we use rpcClient.api.v1...stream.$get(), it should work if typed.
			// If not typed, we can use `rpcClient.request(...)` or similar if available, or just fetch.
			// Given the user asked to use rpcClient, I should try to use it.

			// However, for streaming, the standard client might try to parse JSON.
			// We need to use `$get` and then `res.body`.

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
			setIsLoading(false);
		}
	}, [canvasId, sessionId]);

	// --- Fetch History & Reconnect Stream ---
	useEffect(() => {
		// Clear messages immediately when sessionId changes
		setMessages([]);

		if (!sessionId || !canvasId) {
			setIsLoading(false); // Ensure we reset if no session
			return;
		}
		const fetchHistoryAndConnect = async () => {
			setIsLoading(true);
			try {
				const res = await rpcClient.api.v1.canvas[":id"].agent[
					":sessionId"
				].$get({
					param: { id: canvasId, sessionId },
				});
				if (!res.ok) throw new Error("Failed to fetch session");
				const data = await res.json();
				console.log({ data });

				const historyMessages = (data.messages || []).map((m: any) => ({
					...m,
					createdAt: new Date(m.createdAt),
				}));
				setMessages(historyMessages);

				// If session is active, connect to stream
				if (data.status === "ACTIVE") {
					connectToStream();
				} else {
					setIsLoading(false);
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
				setIsLoading(false);
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
			setIsLoading(true);
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
		setIsLoading(false);
	}, [canvasId, sessionId]);

	const clearPendingPatch = useCallback(() => {
		setPendingPatchId(null);
	}, []);
	console.log({ isLoading });
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
