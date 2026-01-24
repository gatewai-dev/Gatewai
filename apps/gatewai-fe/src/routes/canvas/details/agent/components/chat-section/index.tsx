import {
	ArrowRight,
	Clock,
	MoreHorizontal,
	Plus,
	StopCircle,
	X,
} from "lucide-react";
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
				<div className="flex items-center gap-2 px-2 pt-1">
					<span className="text-[10px] font-medium bg-primary/10 text-primary px-1.5 py-0.5 rounded-md">
						@agent
					</span>
					<Textarea
						ref={textareaRef}
						value={inputValue}
						onChange={(e) => setInputValue(e.target.value)}
						onKeyDown={(e) =>
							e.key === "Enter" &&
							!e.shiftKey &&
							(e.preventDefault(), handleSubmit())
						}
						placeholder="Enter your request..."
						className="flex-1 bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0 resize-none min-h-[24px] max-h-40 p-1 text-xs shadow-none"
						rows={1}
					/>
				</div>

				<div className="flex items-center justify-between px-1 pb-1">
					<div className="flex items-center gap-2">
						<Select value={selectedModel} onValueChange={setSelectedModel}>
							<SelectTrigger className=" text-[10px] border-0 bg-transparent hover:bg-accent/50 gap-1 px-2 w-auto shadow-none focus:ring-0">
								<SelectValue placeholder="Model" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="gemini-3-pro-preview">Gemini 3 Pro</SelectItem>
								<SelectItem value="gemini-3-flash-preview">Gemini 3 Flash</SelectItem>
							</SelectContent>
						</Select>
					</div>

					{isLoading ? (
						<Button
							size="icon"
							variant="ghost"
							onClick={stopGeneration}
							className="h-7 w-7 text-destructive hover:bg-destructive/10 rounded-full"
						>
							<StopCircle className="w-4 h-4" />
						</Button>
					) : (
						<Button
							size="icon"
							onClick={handleSubmit}
							disabled={!inputValue.trim()}
							className="h-7 w-7 rounded-full transition-transform active:scale-95 shadow-lg shadow-primary/20"
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

	// --- Auto-scroll Logic ---
	useEffect(() => {
		const viewport = scrollRef.current?.querySelector(
			"[data-radix-scroll-area-viewport]",
		);
		if (viewport) {
			viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" });
		}
	}, [messages, isLoading]);

	const handleSubmit = useCallback(async () => {
		if (!inputValue.trim() || isLoading) return;
		const msg = inputValue.trim();
		setInputValue("");
		await sendMessage(msg);
		setTimeout(() => {
			const viewport = scrollRef.current?.querySelector(
				"[data-radix-scroll-area-viewport]",
			);
			viewport?.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" });
		}, 120);
	}, [inputValue, isLoading, sendMessage]);

	const isNewSession = !activeSessionId || messages.length === 0;

	return (
		<div className="flex flex-col h-full bg-background/50 relative">
			{/* Header */}
			<div className="sticky top-0 z-10 bg-transparent p-3 flex items-center justify-between">
				<div></div>
				<div className="flex items-center gap-1">
					<Button
						variant="ghost"
						size="icon"
						onClick={createNewSession}
						className="h-7 w-7 rounded-md hover:bg-accent text-muted-foreground transition-colors"
					>
						<Plus className="w-4 h-4" />
					</Button>

					<Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
						<DialogTrigger asChild>
							<Button
								variant="ghost"
								size="icon"
								className="h-7 w-7 rounded-md hover:bg-accent text-muted-foreground transition-colors"
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
					>
						<X className="w-4 h-4" />
					</Button>
				</div>
			</div>

			{/* Content */}
			{isNewSession ? (
				<div className="flex-1 flex flex-col items-center justify-center p-2">
					<div className="w-full max-w-3xl space-y-8">
						<h1 className="text-2xl font-semibold text-foreground/90 px-2">
							Gatewai Agent
						</h1>
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
							{messages.map((msg) => (
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
										)}
									>
										{msg.role === "model" ? (
											<MarkdownRenderer markdown={msg.text} />
										) : (
											<div className="whitespace-pre-wrap">{msg.text}</div>
										)}
										{msg.isStreaming && <LoadingSpinner className="size-5" />}
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