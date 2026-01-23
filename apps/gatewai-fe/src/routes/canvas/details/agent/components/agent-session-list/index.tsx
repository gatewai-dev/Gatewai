import { formatDistanceToNow } from "date-fns";

import { Clock, MessageSquare, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCanvasAgent } from "../../ctx/canvas-agent.ctx";

export function AgentSessionList({ className }: { className?: string }) {
	const {
		agentSessionsList,
		activeSessionId,
		setActiveSessionId,
		createNewSession,
	} = useCanvasAgent();

	return (
		<div
			className={cn(
				"flex flex-col h-full w-64 bg-gray-50/50 border-r border-gray-200",
				className,
			)}
		>
			{/* Header */}
			<div className="p-4 border-b border-gray-100 flex items-center justify-between">
				<h2 className="text-sm font-semibold text-gray-900">Chats</h2>
				<Button
					onClick={createNewSession}
					className="p-1.5 rounded-md hover:bg-gray-200/80 text-gray-600 transition-colors"
					title="New Chat"
				>
					<Plus className="w-4 h-4" />
				</Button>
			</div>

			{/* Scrollable List */}
			<div className="flex-1 overflow-y-auto p-2 space-y-1">
				{!agentSessionsList || agentSessionsList.length === 0 ? (
					<div className="px-4 py-8 text-center text-xs text-gray-400">
						No history yet. Start a conversation.
					</div>
				) : (
					agentSessionsList.map((session) => (
						<Button
							key={session.id}
							onClick={() => setActiveSessionId(session.id)}
							className={cn(
								"w-full text-left px-3 py-3 rounded-lg flex items-start gap-3 transition-all duration-200 group",
								activeSessionId === session.id
									? "bg-white shadow-sm ring-1 ring-gray-200"
									: "hover:bg-gray-100",
							)}
						>
							<MessageSquare
								className={cn(
									"w-4 h-4 mt-0.5",
									activeSessionId === session.id
										? "text-blue-500"
										: "text-gray-400",
								)}
							/>

							<div className="flex-1 min-w-0">
								{/* Fallback title if none exists */}
								<p
									className={cn(
										"text-sm font-medium truncate",
										activeSessionId === session.id
											? "text-gray-900"
											: "text-gray-700",
									)}
								>
									{session.id.slice(0, 8)}...{" "}
									{/* Replace with session.title if avail */}
								</p>

								{session.createdAt && (
									<div className="flex items-center gap-1 mt-1 text-[10px] text-gray-400">
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
			</div>
		</div>
	);
}
