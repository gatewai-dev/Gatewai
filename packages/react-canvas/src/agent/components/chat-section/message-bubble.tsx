import { LoadingSpinner, MarkdownRenderer } from "@gatewai/ui-kit";
import { cn } from "../../../lib/utils";
import { PatchReviewCard } from "../patch-review-card";

export interface MessageProps {
	message: {
		id: string;
		role: string;
		text: string;
		isStreaming?: boolean;
		eventType?: string;
		patchId?: string;
		patchStatus?: any; // strict typing will be handled by context/hooks later
		isPatchOnly?: boolean;
	};
	patchId?: string;
	onPatchComplete?: (status: "ACCEPTED" | "REJECTED") => void;
}

export function MessageBubble({
	message,
	patchId,
	onPatchComplete,
}: MessageProps) {
	const { role, text, isStreaming } = message;

	// System messages
	if (role === "system") {
		return (
			<div className="flex w-full justify-center animate-in slide-in-from-bottom-2 duration-300">
				<div className="bg-accent/40 backdrop-blur-sm text-muted-foreground rounded-full text-center max-w-lg px-4 py-1.5 text-[11px] border border-border/40 font-medium">
					{text}
				</div>
			</div>
		);
	}

	// User messages
	if (role === "user") {
		return (
			<div className="flex w-full justify-end animate-in slide-in-from-bottom-2 duration-300">
				<div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-sm max-w-[85%] px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words shadow-md shadow-primary/20">
					{text}
				</div>
			</div>
		);
	}

	// Model messages
	if (role === "model") {
		return (
			<div className="space-y-3">
				<div className="flex w-full justify-start animate-in slide-in-from-bottom-2 duration-300">
					<div className="bg-white/50 dark:bg-zinc-900/50 backdrop-blur-md border border-border/60 text-foreground rounded-2xl rounded-tl-sm max-w-[90%] px-4 py-3 text-sm leading-relaxed shadow-sm overflow-hidden group">
						<MarkdownRenderer
							className="text-sm prose-sm dark:prose-invert"
							markdown={text}
						/>
						{isStreaming && (
							<div
								className={cn(
									"flex items-center gap-2 mt-3 pt-2 border-t border-border/30",
								)}
							>
								<LoadingSpinner className="size-3.5 text-primary" />
								<span className="text-xs font-medium text-muted-foreground animate-pulse">
									Working...
								</span>
							</div>
						)}
					</div>
				</div>

				{/* Patch card displays after model message */}
				{patchId && (
					<div className="flex w-full justify-start animate-in slide-in-from-bottom-2 duration-300 pl-2">
						<PatchReviewCard
							patchId={patchId}
							initialStatus={message.patchStatus}
							onComplete={onPatchComplete || (() => {})}
						/>
					</div>
				)}
			</div>
		);
	}

	return null;
}

export function LoadingIndicator() {
	return (
		<div className="flex w-full justify-start animate-in slide-in-from-bottom-2 duration-300">
			<div className="bg-white/50 dark:bg-zinc-900/50 backdrop-blur-md border border-border/60 text-foreground rounded-2xl rounded-tl-none max-w-[85%] px-4 py-3 shadow-sm">
				<div className="flex items-center gap-2.5">
					<div className="flex gap-1">
						<div className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce [animation-delay:-0.3s]" />
						<div className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce [animation-delay:-0.15s]" />
						<div className="w-1.5 h-1.5 bg-primary/60 rounded-full animate-bounce" />
					</div>
					<span className="text-xs font-medium text-muted-foreground/80">
						Thinking...
					</span>
				</div>
			</div>
		</div>
	);
}
