import { SendHorizontal, Sparkles, StopCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
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
	"Create workflow for 16 seconds advertisement video clip with 3 consistent characters",
	"Create workflow for 6 minutes of podcast",
];

export function AgentChatSection({ canvasId }: AgentChatSectionProps) {
	const { activeSessionId } = useCanvasAgent();
	const scrollRef = useRef<HTMLDivElement>(null);

	// Local state for input
	const [inputValue, setInputValue] = useState("");
	const [isFocused, setIsFocused] = useState(false);
	const [placeholder, setPlaceholder] = useState("");
	const [currentOptionIndex, setCurrentOptionIndex] = useState(0);

	// Use the streaming hook we created
	const { messages, sendMessage, isLoading, stopGeneration } =
		useAgentChatStream(canvasId, activeSessionId || "");

	// Animated placeholder effect
	useEffect(() => {
		if (isFocused || inputValue) {
			setPlaceholder("Ask anything...");
			return;
		}

		let charIndex = 0;
		let isDeleting = false;
		let timeoutId: NodeJS.Timeout;

		const typeEffect = () => {
			const currentText = PLACEHOLDER_OPTIONS[currentOptionIndex];

			if (!isDeleting && charIndex <= currentText.length) {
				setPlaceholder(currentText.substring(0, charIndex));
				charIndex++;
				timeoutId = setTimeout(typeEffect, 50);
			} else if (!isDeleting && charIndex > currentText.length) {
				// Wait before deleting
				timeoutId = setTimeout(() => {
					isDeleting = true;
					typeEffect();
				}, 2000);
			} else if (isDeleting && charIndex > 0) {
				charIndex--;
				setPlaceholder(currentText.substring(0, charIndex));
				timeoutId = setTimeout(typeEffect, 30);
			} else if (isDeleting && charIndex === 0) {
				// Move to next option
				setCurrentOptionIndex(
					(prev) => (prev + 1) % PLACEHOLDER_OPTIONS.length,
				);
				isDeleting = false;
				timeoutId = setTimeout(typeEffect, 500);
			}
		};

		typeEffect();

		return () => {
			if (timeoutId) clearTimeout(timeoutId);
		};
	}, [currentOptionIndex, isFocused, inputValue]);

	// Auto-scroll to bottom
	useEffect(() => {
		if (scrollRef.current) {
			scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
		}
	}, [messages, isLoading]);

	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSubmit();
		}
	};

	const handleSubmit = async () => {
		if (!inputValue.trim() || !activeSessionId) return;
		const msg = inputValue;
		setInputValue(""); // Clear immediately
		await sendMessage(msg);
	};

	if (!activeSessionId) {
		return (
			<div className="flex-1 flex flex-col items-center justify-center bg-background text-muted-foreground">
				<Sparkles className="w-12 h-12 mb-4 text-muted" />
				<p>Select or create a chat to begin</p>
			</div>
		);
	}

	return (
		<div className="flex-1 flex flex-col bg-transparent h-full relative overflow-hidden">
			{/* --- Chat History --- */}
			<ScrollArea className="flex-1 p-6 space-y-6" ref={scrollRef}>
				{messages.length === 0 && (
					<div className="h-full flex flex-col items-center justify-center opacity-40">
						<h3 className="text-lg font-medium text-foreground">
							How can I help?
						</h3>
					</div>
				)}

				{messages.map((msg) => (
					<div
						key={msg.id}
						className={cn(
							"flex w-full",
							msg.role === "user" ? "justify-end" : "justify-start",
						)}
					>
						<div
							className={cn(
								"flex max-w-[80%] gap-3",
								msg.role === "user" ? "flex-row-reverse" : "flex-row",
							)}
						>
							{/* Bubble */}
							<div
								className={cn(
									"px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm backdrop-blur-sm",
									msg.role === "user"
										? "bg-primary text-primary-foreground rounded-tr-sm"
										: "bg-muted/40 border border-white/5 text-foreground rounded-tl-sm",
								)}
							>
								{msg.role === "user" ? (
									<div className="whitespace-pre-wrap">{msg.text}</div>
								) : (
									<MarkdownRenderer markdown={msg.text} />
								)}

								{msg.isStreaming && (
									<span className="inline-block w-1.5 h-4 ml-1 bg-primary animate-pulse align-middle" />
								)}
							</div>
						</div>
					</div>
				))}
			</ScrollArea>

			{/* --- Input Area --- */}
			<div className="p-4 bg-background/40 backdrop-blur-md border-t border-white/5 sticky bottom-0 z-10">
				<div className="max-w-3xl mx-auto relative flex items-end gap-2 p-2 bg-muted/50 rounded-xl border border-white/5 focus-within:ring-2 focus-within:ring-primary/10 focus-within:border-primary transition-all shadow-sm">
					<Textarea
						value={inputValue}
						onChange={(e) => setInputValue(e.target.value)}
						onKeyDown={handleKeyDown}
						onFocus={() => setIsFocused(true)}
						onBlur={() => setIsFocused(false)}
						placeholder={placeholder}
						className="w-full bg-transparent border-0 focus:ring-0 resize-none min-h-[44px] max-h-32 py-2.5 px-2 text-sm placeholder:text-muted-foreground text-foreground"
						rows={1}
					/>

					<div className="pb-1 pr-1">
						{isLoading ? (
							<Button
								variant="ghost"
								size="icon"
								onClick={stopGeneration}
								className="bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
								aria-label="Stop generation"
							>
								<StopCircle className="w-5 h-5" />
							</Button>
						) : (
							<Button
								variant="ghost"
								size="icon"
								onClick={handleSubmit}
								disabled={!inputValue.trim()}
								className="bg-primary text-primary-foreground hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground transition-colors shadow-sm"
								aria-label="Send message"
							>
								<SendHorizontal className="w-5 h-5" />
							</Button>
						)}
					</div>
				</div>
				<div className="text-center mt-2">
					<p className="text-[10px] text-muted-foreground">
						AI can make mistakes. Check workflow before running.
					</p>
				</div>
			</div>
		</div>
	);
}
