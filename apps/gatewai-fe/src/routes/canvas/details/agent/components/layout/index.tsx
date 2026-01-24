import { useState } from "react";
import { CanvasAgentProvider } from "../../ctx/canvas-agent.ctx";
import { AgentSessionList } from "../agent-session-list";
import { AgentChatSection } from "../chat-section";

function AgentLayoutInner() {
    const [showSidebar, setShowSidebar] = useState(false);
    return (
        <div className="flex w-full h-full bg-background/60 backdrop-blur-xl border border-white/10 shadow-2xl rounded-xl overflow-hidden text-foreground font-sans antialiased">
            <AgentSessionList className={`shrink-0 w-64 border-r border-white/10 bg-muted/20 ${showSidebar ? 'flex' : 'hidden'}`} />
            <div className="flex-1 flex flex-col min-w-0 bg-background/40">
                <AgentChatSection onToggleSidebar={() => setShowSidebar(!showSidebar)} />
            </div>
        </div>
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
