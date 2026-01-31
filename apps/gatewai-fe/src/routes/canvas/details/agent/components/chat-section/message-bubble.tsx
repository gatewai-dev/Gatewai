import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { cn } from "@/lib/utils";
import { MarkdownRenderer } from "../../../components/markdown-renderer";
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
	onPatchComplete?: () => void;
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
				<div className="bg-accent/50 text-muted-foreground rounded-full text-center max-w-lg px-3 py-2 text-xs">
					{text}
				</div>
			</div>
		);
	}

	// User messages
	if (role === "user") {
		return (
			<div className="flex w-full justify-end animate-in slide-in-from-bottom-2 duration-300">
				<div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-sm max-w-[85%] px-2.5 py-1.5 text-sm leading-relaxed whitespace-pre-wrap break-words shadow-sm">
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
					<div className="bg-muted/50 border border-border/50 text-foreground rounded-2xl rounded-tl-sm max-w-[90%] px-2.5 py-2 text-[11px] leading-relaxed shadow-sm overflow-hidden">
						<MarkdownRenderer className="text-sm" markdown={text} />
						{isStreaming && (
							<div
								className={cn("flex items-center gap-2", text.trim() && "mt-2")}
							>
								<LoadingSpinner className="size-4" />
								<span className="text-sm text-muted-foreground">
									Working...
								</span>
							</div>
						)}
					</div>
				</div>

				{/* Patch card displays after model message */}
				{patchId && (
					<div className="flex w-full justify-start animate-in slide-in-from-bottom-2 duration-300">
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
			<div className="bg-muted/50 border border-border/50 text-foreground rounded-2xl rounded-tl-none max-w-[85%] px-3 py-2 text-xs">
				<div className="flex items-center gap-2">
					<LoadingSpinner className="size-3" />
					<span className="text-[10px] text-muted-foreground">Thinking...</span>
				</div>
			</div>
		</div>
	);
}
