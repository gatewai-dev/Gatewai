import { Panel } from "@xyflow/react";
import { useState } from "react";
import { HiSparkles } from "react-icons/hi2";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CanvasAgentProvider } from "../../ctx/canvas-agent.ctx";
import { AgentChatSection } from "../chat-section";

function AgentLayoutInner() {
	const [isCollapsed, setIsCollapsed] = useState(false);

	return (
		<Panel
			className={cn("right-0 bottom-0 top-0 grow w-[320px]", {
				"w-0": isCollapsed,
			})}
			position="top-right"
		>
			<Button
				variant="ghost"
				onClick={() => setIsCollapsed(false)}
				className={cn(
					"absolute top-3 right-3 z-50 w-42 h-12 rounded-full bg-background/80 backdrop-blur-md border border-white/10 shadow-xl flex items-center justify-center hover:bg-accent transition-all",
					{
						hidden: !isCollapsed,
					},
				)}
			>
				<HiSparkles className="size-6 text-primary" />
				Copilot
			</Button>
			<div
				className={cn(
					"flex w-full h-full bg-background/60 backdrop-blur-xl border border-white/10 shadow-2xl rounded-xl overflow-hidden text-foreground font-sans antialiased",
					{
						hidden: isCollapsed,
					},
				)}
			>
				<div className="flex-1 flex flex-col min-w-0 bg-background/40">
					<AgentChatSection onClose={() => setIsCollapsed(true)} />
				</div>
			</div>
		</Panel>
	);
}

// Assuming you have a page component
export function CanvasAgentLayout({ canvasId }: { canvasId: string }) {
	return (
		<CanvasAgentProvider canvasId={canvasId}>
			<AgentLayoutInner />
		</CanvasAgentProvider>
	);
}
