import { useCallback, useEffect, useRef, useState } from "react";
import type { AutosizeTextAreaRef } from "@/components/ui/autosize-textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCanvasAgent } from "../../ctx/canvas-agent.ctx";
import { PatchReviewCard } from "../patch-review-card";
import { ChatHeader } from "./chat-header";
import { EmptyState } from "./empty-state";
import { InputArea } from "./input-area";
import { LoadingIndicator, MessageBubble } from "./message-bubble";

export function AgentChatSection({ onClose }: { onClose: () => void }) {
	const {
		activeSessionId,
		messages,
		sendMessage,
		isLoading,
		stopGeneration,
		pendingPatchId,
		clearPendingPatch,
		createNewSession,
		selectedModel,
		setSelectedModel,
		updatePatchStatus,
		error,
		clearError,
	} = useCanvasAgent();

	// Refs
	const scrollRef = useRef<HTMLDivElement>(null);
	const textareaRef = useRef<AutosizeTextAreaRef>(null);
	const isMountedRef = useRef(true);

	// State
	const [inputValue, setInputValue] = useState("");
	const [isHistoryOpen, setIsHistoryOpen] = useState(false);

	useEffect(() => {
		isMountedRef.current = true;
		return () => {
			isMountedRef.current = false;
		};
	}, []);

	const scrollToBottom = useCallback(() => {
		if (!isMountedRef.current) return;

		const viewport = scrollRef.current?.querySelector(
			"[data-radix-scroll-area-viewport]",
		);

		if (viewport) {
			requestAnimationFrame(() => {
				if (isMountedRef.current) {
					viewport.scrollTo({
						top: viewport.scrollHeight,
						behavior: "smooth",
					});
				}
			});
		}
	}, []);

	useEffect(() => {
		scrollToBottom();
	}, [messages, isLoading, scrollToBottom]);

	const handleSubmit = useCallback(async () => {
		if (!inputValue.trim() || isLoading) return;

		const message = inputValue.trim();
		// AutosizeTextarea handles resizing automatically when value is cleared.
		setInputValue("");

		await sendMessage(message);

		// Ensure scroll after message renders
		setTimeout(() => {
			if (isMountedRef.current) {
				scrollToBottom();
			}
		}, 100);
	}, [inputValue, isLoading, sendMessage, scrollToBottom]);

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			// Ctrl/Cmd + N for new session
			if ((e.ctrlKey || e.metaKey) && e.key === "n") {
				e.preventDefault();
				createNewSession();
			}
			// Escape to close (if not in dialog)
			if (e.key === "Escape" && !isHistoryOpen) {
				onClose();
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [createNewSession, onClose, isHistoryOpen]);

	// Group messages with their associated patches
	const processedMessages = (() => {
		const result: any[] = [];
		const filtered = messages.filter((msg) => {
			const isPatchAction = msg.eventType === "patch_action";
			const hasContent =
				msg.text.trim() !== "" ||
				msg.eventType === "patch_proposed" ||
				msg.isStreaming;
			const isPending =
				msg.eventType === "patch_proposed" && msg.patchId === pendingPatchId;
			return hasContent && !isPending && !isPatchAction;
		});

		for (let i = 0; i < filtered.length; i++) {
			const msg = filtered[i];

			if (msg.eventType === "patch_proposed" && msg.patchId) {
				// Strategy: Try to attach to the NEXT model message first (so text appears before patch)
				// If not available, try to attach to PREVIOUS model message
				// If neither, show standalone

				const nextMsg = filtered[i + 1];
				const prevMsg = result[result.length - 1];

				if (nextMsg && nextMsg.role === "model" && !nextMsg.patchId) {
					// We'll merge this patch into the next message when we process it
					// Temporarily store it on the next message object in the source array?
					// No, that mutates state.
					// We can skip adding this patch now, and when we hit the next message, we check if there was a preceding patch.
					// Actually, let's just mark the next message in our lookahead.
					nextMsg.patchId = msg.patchId;
					nextMsg.patchStatus = msg.patchStatus;
				} else if (prevMsg && prevMsg.role === "model" && !prevMsg.patchId) {
					// Attach to previous
					prevMsg.patchId = msg.patchId;
					prevMsg.patchStatus = msg.patchStatus;
				} else {
					// Standalone
					result.push({ ...msg, isPatchOnly: true });
				}
			} else {
				// Regular message (or already mutated model message from lookahead)
				result.push({ ...msg });
			}
		}
		return result;
	})();

	const isNewSession = !activeSessionId || messages.length === 0;
	const shouldShowLoadingIndicator =
		isLoading &&
		(processedMessages.length === 0 ||
			processedMessages[processedMessages.length - 1]?.role !== "model" ||
			!processedMessages[processedMessages.length - 1]?.isStreaming);

	return (
		<div className="flex flex-col h-full bg-background/50 relative">
			<ChatHeader
				messageCount={messages.length}
				isNewSession={isNewSession}
				createNewSession={createNewSession}
				isHistoryOpen={isHistoryOpen}
				setIsHistoryOpen={setIsHistoryOpen}
				onClose={onClose}
			/>

			{isNewSession ? (
				<EmptyState
					inputValue={inputValue}
					setInputValue={setInputValue}
					isLoading={isLoading}
					handleSubmit={handleSubmit}
					stopGeneration={stopGeneration}
					textareaRef={textareaRef}
					selectedModel={selectedModel}
					setSelectedModel={setSelectedModel}
					error={error}
					clearError={clearError}
				/>
			) : (
				<>
					<ScrollArea
						className="flex-1 grow h-full pb-24 w-full"
						viewPortCn="h-full overflow-auto w-full"
						ref={scrollRef}
					>
						<div className="max-w-3xl mx-auto w-full px-1 py-2 space-y-3 pb-28">
							{processedMessages.map((msg) => (
								<MessageBubble
									key={msg.id}
									message={msg}
									patchId={msg.patchId}
									onPatchComplete={(status) => {
										if (msg.patchId) {
											updatePatchStatus(msg.patchId, status);
										}
										if (msg.isPatchOnly) {
											clearPendingPatch();
										}
									}}
								/>
							))}

							{/* Pending patch (shows after latest message) */}
							{pendingPatchId && (
								<div className="flex w-full justify-start animate-in slide-in-from-bottom-2 duration-300">
									<PatchReviewCard
										patchId={pendingPatchId}
										onComplete={(status) => {
											updatePatchStatus(pendingPatchId, status);
											clearPendingPatch();
										}}
									/>
								</div>
							)}

							{/* Loading indicator */}
							{shouldShowLoadingIndicator && <LoadingIndicator />}
						</div>
					</ScrollArea>

					<div className="absolute bottom-0 inset-x-0 p-2 bg-linear-to-t from-background via-background/90 to-transparent pointer-events-none">
						<InputArea
							inputValue={inputValue}
							setInputValue={setInputValue}
							isLoading={isLoading}
							handleSubmit={handleSubmit}
							stopGeneration={stopGeneration}
							textareaRef={textareaRef}
							selectedModel={selectedModel}
							setSelectedModel={setSelectedModel}
							error={error}
							clearError={clearError}
						/>
						<p className="text-center mt-2 text-[9px] text-muted-foreground/60 pointer-events-auto">
							AI may make mistakes. Double-check all generated workflow.
						</p>
					</div>
				</>
			)}
		</div>
	);
}
