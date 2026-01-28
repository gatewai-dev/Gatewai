import { formatDistanceToNow } from "date-fns";
import { Clock, MessageSquare, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useCanvasAgent } from "../../ctx/canvas-agent.ctx";

export function AgentSessionList({
	className,
	onItemClick,
}: {
	className?: string;
	onItemClick?: () => void;
}) {
	const {
		agentSessionsList,
		activeSessionId,
		setActiveSessionId,
		createNewSession,
	} = useCanvasAgent();
	const dateSorted = [...(agentSessionsList || [])].sort(
		(a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
	);
	return (
		<div
			className={cn(
				"flex flex-col h-full w-64 bg-transparent border-r border-border/50",
				className,
			)}
		>
			{/* Header */}
			<div className="p-3 border-b border-border/50 flex items-center justify-between">
				<DialogTitle className="text-xs font-semibold text-foreground">
					Chats
				</DialogTitle>
				<Button
					onClick={() => {
						createNewSession();
						onItemClick?.();
					}}
					variant="ghost"
					size="icon"
					className="h-6 w-6 rounded-md hover:bg-accent text-muted-foreground transition-colors"
					title="New Chat"
				>
					<Plus className="w-3 h-3" />
				</Button>
			</div>
			{/* Scrollable List */}
			<ScrollArea
				viewPortCn="h-full"
				className="flex-1 p-2 space-y-1 h-full overflow-auto"
			>
				{!dateSorted || dateSorted.length === 0 ? (
					<div className="px-3 py-6 text-center text-[10px] text-muted-foreground">
						No history yet. Start a conversation.
					</div>
				) : (
					dateSorted?.map((session) => (
						<Button
							key={session.id}
							variant="ghost"
							onClick={() => {
								setActiveSessionId(session.id);
								onItemClick?.();
							}}
							className={cn(
								"w-full justify-start text-left px-2 py-2 h-auto rounded-md flex items-start gap-2 transition-all duration-200 group",
								activeSessionId === session.id
									? "bg-accent/50 shadow-sm ring-1 ring-border/50"
									: "hover:bg-accent/30",
							)}
						>
							<MessageSquare
								className={cn(
									"w-3 h-3 mt-0.5 shrink-0",
									activeSessionId === session.id
										? "text-primary"
										: "text-muted-foreground",
								)}
							/>
							<div className="flex-1 min-w-0">
								{/* Fallback title if none exists */}
								<p
									className={cn(
										"text-xs font-medium truncate",
										activeSessionId === session.id
											? "text-foreground"
											: "text-muted-foreground",
									)}
								>
									{session.id.slice(0, 8)}...{" "}
									{/* Replace with session.title if avail */}
								</p>
								{session.createdAt && (
									<div className="flex items-center gap-1 mt-0.5 text-[9px] text-muted-foreground/70">
										<Clock className="w-2.5 h-2.5" />
										{formatDistanceToNow(new Date(session.createdAt), {
											addSuffix: true,
										})}
									</div>
								)}
							</div>
						</Button>
					))
				)}
			</ScrollArea>
		</div>
	);
}
