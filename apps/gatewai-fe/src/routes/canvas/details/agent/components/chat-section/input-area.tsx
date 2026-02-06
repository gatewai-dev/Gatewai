import { ArrowRight, StopCircle, XCircle } from "lucide-react";
import type { AutosizeTextAreaRef } from "@/components/ui/autosize-textarea";
import { AutosizeTextarea } from "@/components/ui/autosize-textarea";
import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const MODEL_OPTIONS = [
	{ value: "gemini-3-pro-preview", label: "Gemini 3 Pro" },
	{ value: "gemini-3-flash-preview", label: "Gemini 3 Flash" },
	{ value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
] as const;

interface InputAreaProps {
	centered?: boolean;
	inputValue: string;
	setInputValue: (value: string) => void;
	isLoading: boolean;
	handleSubmit: () => Promise<void>;
	stopGeneration: () => void;
	textareaRef: React.RefObject<AutosizeTextAreaRef | null>;
	selectedModel: string;
	setSelectedModel: (value: string) => void;
	error?: string | null;
	clearError?: () => void;
}

export function InputArea({
	centered = false,
	inputValue,
	setInputValue,
	isLoading,
	handleSubmit,
	stopGeneration,
	textareaRef,
	selectedModel,
	setSelectedModel,
	error,
	clearError,
}: InputAreaProps) {
	// AutosizeTextarea handles resizing internally.

	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSubmit();
		}
	};

	return (
		<div
			className={cn(
				"w-full max-w-3xl mx-auto",
				!centered && "pointer-events-auto",
			)}
		>
			{error && (
				<div className="mb-2 mx-1 flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-background/60 backdrop-blur-md border border-foreground/5 shadow-sm animate-in slide-in-from-bottom-2 duration-200">
					<div className="flex items-center gap-2.5">
						<div className="h-1.5 w-1.5 rounded-full bg-orange-500/80 shrink-0" />
						<span className="text-xs font-medium text-foreground/80">
							{error}
						</span>
					</div>
					{clearError && (
						<Button
							size="icon"
							variant="ghost"
							onClick={clearError}
							className="h-5 w-5 -mr-1 text-muted-foreground/60 hover:text-foreground hover:bg-foreground/5 rounded-full transition-colors"
						>
							<XCircle className="h-3.5 w-3.5" />
						</Button>
					)}
				</div>
			)}
			<div
				className={cn(
					"relative flex flex-col gap-2 p-1.5 rounded-[20px] border transition-all duration-300",
					"bg-background/95 backdrop-blur-2xl",
					"border-border/40 hover:border-border/80 shadow-lg shadow-black/5",
					"focus-within:border-primary/50 focus-within:ring-4 focus-within:ring-primary/10 focus-within:shadow-xl",
				)}
			>
				{/* Input Field */}
				<div className="flex items-start gap-3 px-2 pt-2">
					<span className="text-[10px] font-bold tracking-wide uppercase bg-primary/10 text-primary px-2 py-1 rounded-md mt-1 flex-shrink-0 select-none">
						Agent
					</span>
					<AutosizeTextarea
						ref={textareaRef}
						value={inputValue}
						onChange={(e) => setInputValue(e.target.value)}
						onKeyDown={handleKeyDown}
						placeholder="Ask anything..."
						className="flex-1 border-0 focus-visible:ring-0 min-h-[24px] focus-visible:ring-offset-0 p-1 text-sm shadow-none bg-transparent placeholder:text-muted-foreground/60"
						minHeight={24}
						maxHeight={160}
						aria-label="Message input"
						disabled={isLoading}
					/>
				</div>

				{/* Controls */}
				<div className="flex items-center justify-between px-2 pb-1 pt-1 border-t border-border/10 mt-1">
					<Select
						value={selectedModel}
						onValueChange={setSelectedModel}
						disabled={isLoading}
					>
						<SelectTrigger
							className="h-7 text-[10px] uppercase font-bold tracking-wider border-0 bg-transparent hover:bg-accent/50 gap-2 px-2.5 w-auto shadow-none focus:ring-0 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
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

					{isLoading ? (
						<Button
							size="icon"
							variant="ghost"
							onClick={stopGeneration}
							className="h-8 w-8 text-destructive bg-destructive/5 hover:bg-destructive/15 rounded-full transition-all duration-200"
							aria-label="Stop generation"
							title="Stop generation"
						>
							<StopCircle className="w-5 h-5 animate-pulse" />
						</Button>
					) : (
						<Button
							size="icon"
							onClick={handleSubmit}
							disabled={!inputValue.trim()}
							className={cn(
								"h-8 w-8 rounded-full transition-all duration-300 shadow-md",
								inputValue.trim()
									? "bg-primary text-primary-foreground shadow-primary/25 hover:scale-105 hover:shadow-lg"
									: "bg-muted text-muted-foreground opacity-50 shadow-none",
							)}
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
