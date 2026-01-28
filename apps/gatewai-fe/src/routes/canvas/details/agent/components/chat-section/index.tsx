import { ArrowRight, Clock, Plus, StopCircle, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { MarkdownRenderer } from "../../../components/markdown-renderer";
import { useCanvasAgent } from "../../ctx/canvas-agent.ctx";
import { AgentSessionList } from "../agent-session-list";
import { PatchReviewCard } from "../patch-review-card";

const MODEL_OPTIONS = [
	{ value: "gemini-3-pro-preview", label: "Gemini 3 Pro" },
	{ value: "gemini-3-flash-preview", label: "Gemini 3 Flash" },
] as const;

function InputArea({
	centered = false,
	inputValue,
	setInputValue,
	isLoading,
	handleSubmit,
	stopGeneration,
	textareaRef,
	selectedModel,
	setSelectedModel,
}: {
	centered?: boolean;
	inputValue: string;
	setInputValue: (value: string) => void;
	isLoading: boolean;
	handleSubmit: () => Promise<void>;
	stopGeneration: () => void;
	textareaRef: React.RefObject<HTMLTextAreaElement | null>;
	selectedModel: string;
	setSelectedModel: (value: string) => void;
}) {
	// Auto-resize textarea
	useEffect(() => {
		const textarea = textareaRef.current;
		if (!textarea) return;

		// Reset height to auto to get the correct scrollHeight
		textarea.style.height = "auto";
		// Set height to scrollHeight, capped at max-height
		const newHeight = Math.min(textarea.scrollHeight, 160); // 160px = max-h-40
		textarea.style.height = `${newHeight}px`;
	}, [inputValue, textareaRef]);

	return (
		<div
			className={cn(
				"w-full max-w-3xl mx-auto",
				centered ? "" : "pointer-events-auto",
			)}
		>
			<div
				className={cn(
					"relative flex flex-col gap-2 p-2 rounded-2xl border transition-all duration-200",
					"bg-background/80 backdrop-blur-xl",
					"border-border shadow-2xl shadow-black/5",
					"focus-within:border-primary/50 focus-within:ring-4 focus-within:ring-primary/5",
				)}
			>
				<div className="flex items-start gap-2 px-2 pt-1">
					<span className="text-[10px] font-medium bg-primary/10 text-primary px-1.5 py-0.5 rounded-md mt-1 flex-shrink-0">
						@agent
					</span>
					<Textarea
						ref={textareaRef}
						value={inputValue}
						onChange={(e) => setInputValue(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter" && !e.shiftKey) {
								e.preventDefault();
								handleSubmit();
							}
						}}
						placeholder="Enter your request..."
						className="flex-1 bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0 resize-none min-h-[24px] max-h-40 p-1 text-xs shadow-none overflow-y-auto"
						rows={1}
						aria-label="Message input"
						disabled={isLoading}
					/>
				</div>

				<div className="flex items-center justify-between px-1 pb-1">
					<div className="flex items-center gap-2">
						<Select
							value={selectedModel}
							onValueChange={setSelectedModel}
							disabled={isLoading}
						>
							<SelectTrigger
								className="text-[10px] border-0 bg-transparent hover:bg-accent/50 gap-1 px-2 w-auto shadow-none focus:ring-0"
								aria-label="Select AI model"
							>
								<SelectValue placeholder="Model" />
							</SelectTrigger>
							<SelectContent>
								{MODEL_OPTIONS.map((option) => (
									<SelectItem key={option.value} value={option.value}>
										{option.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					{isLoading ? (
						<Button
							size="icon"
							variant="ghost"
							onClick={stopGeneration}
							className="h-7 w-7 text-destructive hover:bg-destructive/10 rounded-full"
							aria-label="Stop generation"
						>
							<StopCircle className="w-4 h-4" />
						</Button>
					) : (
						<Button
							size="icon"
							onClick={handleSubmit}
							disabled={!inputValue.trim()}
							className="h-7 w-7 rounded-full transition-transform active:scale-95 shadow-lg shadow-primary/20"
							aria-label="Send message"
						>
							<ArrowRight className="size-4" />
						</Button>
					)}
				</div>
			</div>
			{centered && (
				<p className="text-center mt-4 text-[10px] text-muted-foreground/60">
					AI may make mistakes. Double-check all generated workflow.
				</p>
			)}
		</div>
	);
}

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
	} = useCanvasAgent();

	const scrollRef = useRef<HTMLDivElement | null>(null);
	const textareaRef = useRef<HTMLTextAreaElement | null>(null);
	const [inputValue, setInputValue] = useState("");
	const [isHistoryOpen, setIsHistoryOpen] = useState(false);
	const isMountedRef = useRef(true);

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

	// Auto-scroll on new messages or loading state changes
	useEffect(() => {
		scrollToBottom();
	}, [messages, isLoading, scrollToBottom]);

	const handleSubmit = useCallback(async () => {
		if (!inputValue.trim() || isLoading) return;

		const msg = inputValue.trim();
		setInputValue("");

		// Reset textarea height
		if (textareaRef.current) {
			textareaRef.current.style.height = "auto";
		}

		await sendMessage(msg);

		// Scroll after a short delay to ensure message is rendered
		setTimeout(() => {
			if (isMountedRef.current) {
				scrollToBottom();
			}
		}, 100);
	}, [inputValue, isLoading, sendMessage, scrollToBottom]);

	// Keyboard shortcuts
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

	const isNewSession = !activeSessionId || messages.length === 0;

	return (
		<div className="flex flex-col h-full bg-background/50 relative">
			{/* Header */}
			<div className="sticky top-0 z-10 bg-transparent p-3 flex items-center justify-between">
				<div className="text-xs text-muted-foreground">
					{!isNewSession && (
						<span className="opacity-70">
							{messages.length} message{messages.length !== 1 ? "s" : ""}
						</span>
					)}
				</div>
				<div className="flex items-center gap-1">
					<Button
						variant="ghost"
						size="icon"
						onClick={createNewSession}
						className="h-7 w-7 rounded-md hover:bg-accent text-muted-foreground transition-colors"
						aria-label="New session (Ctrl+N)"
						title="New session (Ctrl+N)"
					>
						<Plus className="w-4 h-4" />
					</Button>

					<Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
						<DialogTrigger asChild>
							<Button
								variant="ghost"
								size="icon"
								className="h-7 w-7 rounded-md hover:bg-accent text-muted-foreground transition-colors"
								aria-label="View history"
								title="View history"
							>
								<Clock className="w-4 h-4" />
							</Button>
						</DialogTrigger>
						<DialogContent className="sm:max-w-[425px] p-0 overflow-hidden bg-background/95 backdrop-blur-xl border-white/10">
							<AgentSessionList
								className="w-full border-none bg-transparent"
								onItemClick={() => setIsHistoryOpen(false)}
							/>
						</DialogContent>
					</Dialog>

					<Button
						variant="ghost"
						size="icon"
						onClick={onClose}
						className="h-7 w-7 rounded-md hover:bg-accent text-muted-foreground transition-colors"
						aria-label="Close (Esc)"
						title="Close (Esc)"
					>
						<X className="w-4 h-4" />
					</Button>
				</div>
			</div>

			{/* Content */}
			{isNewSession ? (
				<div className="flex-1 flex flex-col items-center justify-center p-2">
					<div className="w-full max-w-3xl space-y-8">
						<div className="space-y-2 px-2">
							<h1 className="text-2xl font-semibold text-foreground/90">
								Gatewai Copilot
							</h1>
							<p className="text-sm text-muted-foreground">
								Your AI assistant for workflow automation
							</p>
						</div>
						<InputArea
							centered
							inputValue={inputValue}
							setInputValue={setInputValue}
							isLoading={isLoading}
							handleSubmit={handleSubmit}
							stopGeneration={stopGeneration}
							textareaRef={textareaRef}
							selectedModel={selectedModel}
							setSelectedModel={setSelectedModel}
						/>
					</div>
				</div>
			) : (
				<>
					<ScrollArea
						className="flex-1 grow h-full pb-24"
						viewPortCn="h-full overflow-auto"
						ref={scrollRef}
					>
						<div className="max-w-3xl mx-auto w-full p-2 space-y-6 pb-28">
							{messages
								.filter(
									(msg) =>
										msg.text.trim() !== "" ||
										msg.eventType === "patch_proposed" ||
										msg.isStreaming,
								)
								.map((msg) => (
									<div
										key={msg.id}
										className={cn(
											"flex w-full animate-in slide-in-from-bottom-2 duration-300",
											msg.role === "user"
												? "justify-end"
												: msg.role === "system"
													? "justify-center"
													: "justify-start",
										)}
									>
										<div
											className={cn(
												"px-3 py-2 rounded-2xl text-xs transition-all",
												msg.role === "system"
													? "bg-accent/50 text-muted-foreground rounded-full text-center max-w-lg"
													: msg.role === "user"
														? "bg-primary text-primary-foreground rounded-tr-none max-w-[85%]"
														: "bg-muted/50 border border-border/50 text-foreground rounded-tl-none max-w-[85%]",
												msg.eventType === "patch_proposed" &&
													"bg-transparent border-0 p-0 max-w-full w-full",
											)}
											role={msg.role === "system" ? "status" : undefined}
											aria-live={msg.isStreaming ? "polite" : undefined}
										>
											{msg.eventType === "patch_proposed" && msg.patchId ? (
												<PatchReviewCard
													patchId={msg.patchId}
													onComplete={() => {}} // No-op for history patches
												/>
											) : msg.role === "model" ? (
												<>
													<MarkdownRenderer markdown={msg.text} />
													{msg.isStreaming && (
														<div className="flex items-center gap-2 mt-2">
															<LoadingSpinner className="size-4" />
															<span className="text-[10px] text-muted-foreground">
																Generating...
															</span>
														</div>
													)}
												</>
											) : (
												<div className="whitespace-pre-wrap">{msg.text}</div>
											)}
										</div>
									</div>
								))}
							{pendingPatchId && (
								<div className="flex w-full justify-start animate-in slide-in-from-bottom-2 duration-300">
									<PatchReviewCard
										patchId={pendingPatchId}
										onComplete={clearPendingPatch}
									/>
								</div>
							)}
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
