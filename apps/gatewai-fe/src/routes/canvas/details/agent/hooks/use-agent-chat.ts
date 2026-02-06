import type { GatewaiAgentEvent } from "@gatewai/types";
import { useCallback, useEffect, useRef, useState } from "react";
import { generateId } from "@/lib/idgen";
import { rpcClient } from "@/rpc/client";

export type MessageRole = "user" | "model" | "system";

export interface ChatMessage {
	id: string;
	role: MessageRole;
	text: string;
	isStreaming?: boolean;
	eventType?: string;
	patchId?: string;
	patchStatus?: "PENDING" | "ACCEPTED" | "REJECTED";
	createdAt: Date;
}

// Utility to read SSE stream and yield typed events
async function* readStream(
	reader: ReadableStreamDefaultReader<Uint8Array>,
): AsyncGenerator<GatewaiAgentEvent, void, unknown> {
	const decoder = new TextDecoder();
	let buffer = "";

	try {
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
						const event = JSON.parse(jsonStr) as GatewaiAgentEvent;
						yield event;
					} catch (e) {
						console.error("Error parsing SSE JSON:", e);
					}
				}
			}
		}
	} finally {
		reader.releaseLock();
	}
}

export function useAgentChatStream(
	canvasId: string,
	sessionId: string,
	model: string,
) {
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [isRequestPending, setIsRequestPending] = useState(false);
	const [pendingPatchId, setPendingPatchId] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const abortControllerRef = useRef<AbortController | null>(null);

	// Shared handler for processing stream events
	const processStream = useCallback(
		async (
			reader: ReadableStreamDefaultReader<Uint8Array>,
			aiMsgId?: string,
		) => {
			let aiTextAccumulator = "";
			let currentAiMsgId = aiMsgId;

			// If resuming a stream (e.g. initial load), try to find existing streaming message
			if (!currentAiMsgId) {
				setMessages((prev) => {
					const lastMsg = prev[prev.length - 1];
					if (lastMsg && lastMsg.role === "model" && lastMsg.isStreaming) {
						aiTextAccumulator = lastMsg.text;
						currentAiMsgId = lastMsg.id;
					}
					return prev;
				});
			}

			try {
				for await (const event of readStream(reader)) {
					if (event.type === "done") {
						break;
					}

					if (event.type === "error") {
						console.error("Agent error:", event.error);
						// We could add an error message to the chat here if desired
						break;
					}

					if (event.type === "patch_proposed") {
						setPendingPatchId(event.patchId);
						setMessages((prev) => {
							// Check if already exists
							if (prev.some((m) => m.patchId === event.patchId)) return prev;
							return [
								...prev,
								{
									id: generateId(),
									role: "model",
									text: "", // Patch events might not have text, handled by UI
									eventType: "patch_proposed",
									patchId: event.patchId,
									patchStatus: "PENDING",
									createdAt: new Date(),
								},
							];
						});
					}

					if (
						event.type === "raw_model_stream_event" &&
						event.data?.type === "output_text_delta"
					) {
						const delta = event.data.delta || "";
						aiTextAccumulator += delta;

						setMessages((prev) => {
							// If we have a specific ID, update it
							if (currentAiMsgId) {
								return prev.map((msg) =>
									msg.id === currentAiMsgId
										? { ...msg, text: aiTextAccumulator }
										: msg,
								);
							}

							// Otherwise try to find the last streaming message or create new
							const lastMsg = prev[prev.length - 1];
							if (lastMsg && lastMsg.role === "model" && lastMsg.isStreaming) {
								currentAiMsgId = lastMsg.id;
								return prev.map((msg) =>
									msg.id === lastMsg.id
										? { ...msg, text: aiTextAccumulator }
										: msg,
								);
							} else {
								// Create new message
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
				}
			} catch (err) {
				if (err instanceof Error && err.name !== "AbortError") {
					console.error("Stream processing error:", err);
				}
			} finally {
				// Stop streaming indicator
				if (currentAiMsgId) {
					setMessages((prev) =>
						prev.map((msg) =>
							msg.id === currentAiMsgId ? { ...msg, isStreaming: false } : msg,
						),
					);
				}
			}
		},
		[],
	);

	const connectToStream = useCallback(async () => {
		if (abortControllerRef.current) {
			abortControllerRef.current.abort();
		}
		abortControllerRef.current = new AbortController();

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

			// We don't implement the full complexity of "accumulating" from previous messages here
			// because `connectToStream` is usually called on load/reconnect.
			// The `processStream` helper handles attaching to existing streaming message if any.
			await processStream(res.body.getReader());
		} catch (error) {
			if (error instanceof Error && error.name !== "AbortError") {
				console.error("Connection stream error:", error);
			}
		} finally {
			abortControllerRef.current = null;
		}
	}, [canvasId, sessionId, processStream]);

	// --- Fetch History & Reconnect Stream ---
	useEffect(() => {
		// Clear messages immediately when sessionId changes
		setMessages([]);

		if (!sessionId || !canvasId) {
			setIsRequestPending(false);
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
				setIsRequestPending(false);

				// Connect to stream if active
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
						json: { message, model },
					},
					{
						init: {
							signal: abortControllerRef.current.signal,
						},
					},
				);

				if (!response.ok) {
					const errorText = await response.text();
					throw new Error(errorText || "Failed to send message");
				}

				if (!response.body) throw new Error("No response body");

				await processStream(response.body.getReader(), aiMsgId);
			} catch (error) {
				if (error instanceof Error && error.name !== "AbortError") {
					console.error("Send message error:", error);
					setError(error.message);
					// Mark message as not streaming if error
					setMessages((prev) =>
						prev.map((msg) =>
							msg.id === aiMsgId ? { ...msg, isStreaming: false } : msg,
						),
					);
				}
			} finally {
				setIsRequestPending(false);
				abortControllerRef.current = null;
			}
		},
		[canvasId, sessionId, model, processStream],
	);

	const stopGeneration = useCallback(async () => {
		if (abortControllerRef.current) {
			abortControllerRef.current.abort();
		}
		// Ensure that any streaming message is marked as done
		setMessages((prev) =>
			prev.map((msg) =>
				msg.isStreaming ? { ...msg, isStreaming: false } : msg,
			),
		);
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

	const updateMessage = useCallback(
		(id: string, updates: Partial<ChatMessage>) => {
			setMessages((prev) =>
				prev.map((msg) => (msg.id === id ? { ...msg, ...updates } : msg)),
			);
		},
		[],
	);

	const updatePatchStatus = useCallback(
		(patchId: string, status: "PENDING" | "ACCEPTED" | "REJECTED") => {
			setMessages((prev) =>
				prev.map((msg) =>
					msg.patchId === patchId ? { ...msg, patchStatus: status } : msg,
				),
			);
		},
		[],
	);

	const clearError = useCallback(() => setError(null), []);

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
		updateMessage,
		updatePatchStatus,
		error,
		clearError,
	};
}
