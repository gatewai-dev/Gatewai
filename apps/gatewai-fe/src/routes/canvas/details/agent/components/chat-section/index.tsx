import { SendHorizontal, Sparkles, StopCircle } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { MarkdownRenderer } from "../../../components/markdown-renderer";
import { useCanvasAgent } from "../../ctx/canvas-agent.ctx";
import { useAgentChatStream } from "../../hooks/use-agent-chat";

interface AgentChatSectionProps {
	canvasId: string;
}

const PLACEHOLDER_OPTIONS = [
	"Teach me Gatewai studio please.",
	"Create workflow for 16 seconds advertisement video clip...",
	"Create workflow for 12 minutes of podcast about AI...",
];

export function AgentChatSection({ canvasId }: AgentChatSectionProps) {
	const { activeSessionId } = useCanvasAgent();
	const scrollRef = useRef<HTMLDivElement>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	const [inputValue, setInputValue] = useState("");
	const [isFocused, setIsFocused] = useState(false);
	const [typingText, setTypingText] = useState("");
	const [optionIndex, setOptionIndex] = useState(0);

	const { messages, sendMessage, isLoading, stopGeneration } =
		useAgentChatStream(canvasId, activeSessionId || "");
	console.log({ messages });
	// --- Computed State ---
	const displayPlaceholder = useMemo(() => {
		if (isLoading) return "Working...";
		if (isFocused || inputValue) return "Ask anything...";
		return typingText;
	}, [isLoading, isFocused, inputValue, typingText]);

	// --- Animated Placeholder Effect ---
	useEffect(() => {
		if (isFocused || inputValue || isLoading) return;

		let charIndex = 0;
		let isDeleting = false;
		let timeoutId: NodeJS.Timeout;

		const type = () => {
			const fullText = PLACEHOLDER_OPTIONS[optionIndex];

			setTypingText(fullText.substring(0, charIndex));

			if (!isDeleting && charIndex < fullText.length) {
				charIndex++;
				timeoutId = setTimeout(type, 50);
			} else if (isDeleting && charIndex > 0) {
				charIndex--;
				timeoutId = setTimeout(type, 30);
			} else {
				// Pause at full text or empty text
				isDeleting = !isDeleting;
				if (!isDeleting)
					setOptionIndex((prev) => (prev + 1) % PLACEHOLDER_OPTIONS.length);
				timeoutId = setTimeout(type, isDeleting ? 2000 : 500);
			}
		};

		timeoutId = setTimeout(type, 500);
		return () => clearTimeout(timeoutId);
	}, [optionIndex, isFocused, inputValue, isLoading]);

	// --- Auto-scroll Logic ---
	useEffect(() => {
		const viewport = scrollRef.current?.querySelector(
			"[data-radix-scroll-area-viewport]",
		);
		if (viewport) {
			viewport.scrollTo({ top: viewport.scrollHeight, behavior: "smooth" });
		}
	}, [messages, isLoading]);

	const handleSubmit = async () => {
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
	};

	if (!activeSessionId) {
		return (
			<div className="flex-1 flex flex-col items-center justify-center bg-background text-muted-foreground animate-in fade-in duration-500">
				<Sparkles className="w-10 h-10 mb-4 text-primary/20" />
				<p className="text-sm font-medium">
					Select a session to start collaborating
				</p>
			</div>
		);
	}

	return (
		<div className="flex-1 flex flex-col bg-background/50 h-full relative">
			<ScrollArea className="flex-1 h-full" viewPortCn="h-full" ref={scrollRef}>
				<div className="max-w-3xl mx-auto w-full p-6 space-y-8 pb-32">
					{messages.length === 0 && (
						<div className="py-20 text-center opacity-40">
							<h3 className="text-xl font-semibold tracking-tight">
								How can I help?
							</h3>
						</div>
					)}
					{messages.map((msg) => (
						<div
							key={msg.id}
							className={cn(
								"flex w-full animate-in slide-in-from-bottom-2 duration-300",
								msg.role === "user" ? "justify-end" : "justify-start",
							)}
						>
							<div
								className={cn(
									"max-w-[85%] px-4 py-3 rounded-2xl text-sm transition-all",
									msg.role === "user"
										? "bg-primary text-primary-foreground rounded-tr-none"
										: "bg-muted/50 border border-border/50 text-foreground rounded-tl-none",
								)}
							>
								{msg.role === "user" ? (
									<div className="whitespace-pre-wrap">{msg.text}</div>
								) : (
									<MarkdownRenderer markdown={msg.text} />
								)}
								{msg.isStreaming && <LoadingSpinner className="size-6" />}
							</div>
						</div>
					))}
				</div>
			</ScrollArea>

			{/* --- Input Container --- */}
			<div className="absolute bottom-0 inset-x-0 p-6 bg-linear-to-t from-background via-background/90 to-transparent pointer-events-none">
				<div className="max-w-3xl mx-auto pointer-events-auto">
					<div
						className={cn(
							"relative flex items-end gap-2 p-2 rounded-2xl border transition-all duration-200",
							"bg-background/80 backdrop-blur-xl",
							"border-border shadow-2xl shadow-black/5",
							"focus-within:border-primary/50 focus-within:ring-4 focus-within:ring-primary/5",
						)}
					>
						<Textarea
							ref={textareaRef}
							value={inputValue}
							onChange={(e) => setInputValue(e.target.value)}
							onKeyDown={(e) =>
								e.key === "Enter" &&
								!e.shiftKey &&
								(e.preventDefault(), handleSubmit())
							}
							onFocus={() => setIsFocused(true)}
							onBlur={() => setIsFocused(false)}
							placeholder={displayPlaceholder}
							className="flex-1 bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0 resize-none min-h-11 max-h-48 py-3 px-3 text-sm"
							rows={1}
						/>

						<div className="flex items-center gap-2 pr-1 pb-1">
							{isLoading ? (
								<Button
									size="icon"
									variant="ghost"
									onClick={stopGeneration}
									className="h-9 w-9 text-destructive hover:bg-destructive/10 rounded-xl"
								>
									<StopCircle className="w-5 h-5" />
								</Button>
							) : (
								<Button
									size="icon"
									onClick={handleSubmit}
									disabled={!inputValue.trim()}
									className="h-9 w-9 rounded-xl transition-transform active:scale-95 shadow-lg shadow-primary/20"
								>
									<SendHorizontal className="w-4 h-4" />
								</Button>
							)}
						</div>
					</div>
					<p className="text-center mt-3 text-[10px] text-muted-foreground/60">
						AI can make mistakes. Check workflow before running.
					</p>
				</div>
			</div>
		</div>
	);
}
