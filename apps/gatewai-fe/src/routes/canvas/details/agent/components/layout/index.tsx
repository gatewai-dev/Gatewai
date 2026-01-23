import { CanvasAgentProvider } from "../../ctx/canvas-agent.ctx";
import { AgentSessionList } from "../agent-session-list";
import { AgentChatSection } from "../chat-section";

// Assuming you have a page component
export function CanvasAgentLayout({ canvasId }: { canvasId: string }) {
	return (
		<CanvasAgentProvider canvasId={canvasId}>
			<div className="flex h-[600px] w-full bg-background/60 backdrop-blur-xl border border-white/10 shadow-2xl rounded-xl overflow-hidden text-foreground font-sans antialiased">
				<AgentSessionList className="hidden lg:flex shrink-0 w-64 border-r border-white/10 bg-muted/20" />

				{/* Main Chat Area */}
				<div className="flex-1 flex flex-col min-w-0 bg-background/40">
					{/* You might want a mobile toggle for the sidebar here */}
					<AgentChatSection canvasId={canvasId} />
				</div>
			</div>
		</CanvasAgentProvider>
	);
}
