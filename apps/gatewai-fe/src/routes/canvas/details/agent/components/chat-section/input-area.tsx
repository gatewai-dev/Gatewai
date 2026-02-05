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
					"relative flex flex-col gap-1.5 p-1 rounded-xl border transition-all duration-200",
					"bg-background/80 backdrop-blur-xl",
					"border-border/60 shadow-xl shadow-black/5",
					"focus-within:border-primary/50 focus-within:ring-4 focus-within:ring-primary/5",
				)}
			>
				{/* Input Field */}
				<div className="flex items-start gap-2 px-1 pt-1">
					<span className="text-[10px] font-medium bg-primary/10 text-primary px-1.5 py-0.5 rounded-md mt-1 flex-shrink-0">
						@agent
					</span>
					<AutosizeTextarea
						ref={textareaRef}
						value={inputValue}
						onChange={(e) => setInputValue(e.target.value)}
						onKeyDown={handleKeyDown}
						placeholder="Enter your request..."
						className="flex-1 border-0 focus-visible:ring-0 min-h-[24px] focus-visible:ring-offset-0 p-1 text-xs shadow-none"
						minHeight={24}
						maxHeight={160}
						aria-label="Message input"
						disabled={isLoading}
					/>
				</div>

				{/* Controls */}
				<div className="flex items-center justify-between px-1 pb-1">
					<Select
						value={selectedModel}
						onValueChange={setSelectedModel}
						disabled={isLoading}
					>
						<SelectTrigger
							className="text-[10px] border-0 hover:bg-accent/50 gap-1 px-2 w-auto shadow-none focus:ring-0"
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
							className="h-7 w-7 text-destructive hover:bg-destructive/10 rounded-full"
							aria-label="Stop generation"
							title="Stop generation"
						>
							<StopCircle className="w-4 h-4" />
						</Button>
					) : (
						<Button
							size="icon"
							onClick={handleSubmit}
							disabled={!inputValue.trim()}
							className="h-6 w-6 rounded-full transition-transform active:scale-95 shadow-lg shadow-primary/20"
							aria-label="Send message"
						>
							<ArrowRight className="size-3.5" />
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
