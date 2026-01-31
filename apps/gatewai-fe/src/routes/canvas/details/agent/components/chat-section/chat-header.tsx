import { Clock, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { AgentSessionList } from "../agent-session-list";

interface ChatHeaderProps {
	messageCount: number;
	isNewSession: boolean;
	createNewSession: () => void;
	isHistoryOpen: boolean;
	setIsHistoryOpen: (open: boolean) => void;
	onClose: () => void;
}

export function ChatHeader({
	messageCount,
	isNewSession,
	createNewSession,
	isHistoryOpen,
	setIsHistoryOpen,
	onClose,
}: ChatHeaderProps) {
	return (
		<div className="sticky top-0 z-10 bg-transparent p-2 flex items-center justify-between">
			<div className="text-xs text-muted-foreground">
				{!isNewSession && (
					<span className="opacity-70">
						{messageCount} message{messageCount !== 1 ? "s" : ""}
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
	);
}
