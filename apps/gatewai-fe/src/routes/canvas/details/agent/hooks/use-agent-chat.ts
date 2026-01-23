import { useCallback, useRef, useState } from "react";

export type MessageRole = "user" | "model" | "system";

export interface ChatMessage {
	id: string;
	role: MessageRole;
	text: string;
	isStreaming?: boolean;
	createdAt: Date;
}

export function useAgentChatStream(canvasId: string, sessionId: string) {
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const abortControllerRef = useRef<AbortController | null>(null);

	const sendMessage = useCallback(
		async (message: string) => {
			if (!message.trim() || !sessionId) return;

			// 1. Optimistic User Message
			const userMsgId = crypto.randomUUID();
			const userMsg: ChatMessage = {
				id: userMsgId,
				role: "user",
				text: message,
				createdAt: new Date(),
			};

			// 2. Placeholder AI Message (for streaming content)
			const aiMsgId = crypto.randomUUID();
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
				// 3. Fetch with Stream Handling
				// Note: We use fetch because EventSource does not support POST bodies
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
				
				 while (true) {
				 	const { done, value } = await reader.read();
				 	if (done) break;
				
				 	const chunk = decoder.decode(value);
				 	const lines = chunk.split("\n\n");
				 	// Parse SSE format: "data: {...}\n\n"
                    console.log({chunkParsed, lines})
				 	for (const line of lines) {
                        const chunkParsed = JSON.parse(line);
				 		if (line.startsWith("data: ")) {
				 			try {
				 				const jsonStr = line.replace("data: ", "");
				 				if (jsonStr === "[DONE]") continue;
				
				 				const event = JSON.parse(jsonStr);
				
				 				// Assuming 'event' structure based on Google ADK or typical LLM delta
				 				// Adjust 'event.candidates[0].content' based on your specific runner output
				 				// Here we assume the runner outputs partial text in a specific field
				 				const textDelta =
				 					event.candidates?.[0]?.content?.parts?.[0]?.text || "";
				
				 				aiTextAccumulator += textDelta;
				
				 				setMessages((prev) =>
				 					prev.map((msg) =>
				 						msg.id === aiMsgId
				 							? { ...msg, text: aiTextAccumulator }
				 							: msg,
				 					),
				 				);
				 			} catch (e) {
				 				console.error("Error parsing SSE chunk", e);
				 			}
				 		}
				 	}
				 }
			} catch (error) {
				if (error instanceof Error &&  error.name !== "AbortError") {
					console.error("Stream error:", error);
					// Optionally add an error message to the chat
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

	return { messages, sendMessage, isLoading, stopGeneration, setMessages };
}
