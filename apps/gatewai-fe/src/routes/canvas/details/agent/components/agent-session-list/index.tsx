import { formatDistanceToNow } from "date-fns";

import { Clock, MessageSquare, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useCanvasAgent } from "../../ctx/canvas-agent.ctx";

export function AgentSessionList({ className }: { className?: string }) {
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
			<div className="p-4 border-b border-border/50 flex items-center justify-between">
				<h2 className="text-sm font-semibold text-foreground">Chats</h2>
				<Button
					onClick={createNewSession}
					variant="ghost"
					size="icon"
					className="h-7 w-7 rounded-md hover:bg-accent text-muted-foreground transition-colors"
					title="New Chat"
				>
					<Plus className="w-4 h-4" />
				</Button>
			</div>

			{/* Scrollable List */}
			<ScrollArea
				viewPortCn="h-full"
				className="flex-1 p-2 space-y-1 h-full overflow-auto"
			>
				{!dateSorted || dateSorted.length === 0 ? (
					<div className="px-4 py-8 text-center text-xs text-muted-foreground">
						No history yet. Start a conversation.
					</div>
				) : (
					dateSorted?.map((session) => (
						<Button
							key={session.id}
							variant="ghost"
							onClick={() => setActiveSessionId(session.id)}
							className={cn(
								"w-full justify-start text-left px-3 py-3 h-auto rounded-lg flex items-start gap-3 transition-all duration-200 group",
								activeSessionId === session.id
									? "bg-accent/50 shadow-sm ring-1 ring-border/50"
									: "hover:bg-accent/30",
							)}
						>
							<MessageSquare
								className={cn(
									"w-4 h-4 mt-0.5 shrink-0",
									activeSessionId === session.id
										? "text-primary"
										: "text-muted-foreground",
								)}
							/>

							<div className="flex-1 min-w-0">
								{/* Fallback title if none exists */}
								<p
									className={cn(
										"text-sm font-medium truncate",
										activeSessionId === session.id
											? "text-foreground"
											: "text-muted-foreground",
									)}
								>
									{session.id.slice(0, 8)}...{" "}
									{/* Replace with session.title if avail */}
								</p>

								{session.createdAt && (
									<div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground/70">
										<Clock className="w-3 h-3" />
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
