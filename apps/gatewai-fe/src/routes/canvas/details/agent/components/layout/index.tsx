import { Gemini } from "@lobehub/icons";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CanvasAgentProvider } from "../../ctx/canvas-agent.ctx";
import { AgentChatSection } from "../chat-section";

function AgentLayoutInner() {
	const [isCollapsed, setIsCollapsed] = useState(false);

	return (
		<>
			<Button
				variant="ghost"
				onClick={() => setIsCollapsed(false)}
				className={cn(
					"absolute top-3 right-3 z-50 w-12 h-12 rounded-full bg-background/80 backdrop-blur-md border border-white/10 shadow-xl flex items-center justify-center hover:bg-accent transition-all",
					{
						hidden: !isCollapsed,
					},
				)}
			>
				<Gemini.Color className="size-7 text-foreground" />
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
					<AgentChatSection
						onToggleSidebar={() => setIsCollapsed((collapsed) => !collapsed)}
					/>
				</div>
			</div>
		</>
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
