import { CanvasAgentProvider } from "../../ctx/canvas-agent.ctx";
import { AgentSessionList } from "../agent-session-list";
import { AgentChatSection } from "../chat-section";

// Assuming you have a page component
export function CanvasAgentLayout({ canvasId }: { canvasId: string }) {
	return (
		<CanvasAgentProvider canvasId={canvasId}>
			<div className="flex h-[600px] w-full bg-background/60 backdrop-blur-xl border border-white/10 shadow-2xl rounded-xl overflow-hidden text-foreground font-sans antialiased">
				{/* Sidebar - Hidden by default in this widget view, or we can make it an overlay. 
            For now, let's keep it but maybe make it smaller or collapsible if we had time. 
            Given the constraints, I'll hide it for now to focus on the chat experience in the widget, 
            or I can make the widget wider. Let's make the widget wider in the toolbar.
            Actually, let's just hide the sidebar in this layout for now as it takes up too much space 
            and the user wants a "Chat UI". 
            Wait, if I hide it, they can't switch sessions.
            I'll leave it as is but I'll update the Toolbar to make the widget wider, say w-[800px] if space permits? 
            No, a chat widget is usually narrow.
            I will modify the layout to be just the chat, and maybe add a button in the chat header to show history.
            But for this step, I will just apply the styles.
        */}
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
