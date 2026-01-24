import { Gemini } from "@lobehub/icons";
import { useState } from "react";
import { CanvasAgentProvider } from "../../ctx/canvas-agent.ctx";
import { AgentChatSection } from "../chat-section";

function AgentLayoutInner() {
	const [isCollapsed, setIsCollapsed] = useState(false);

	if (isCollapsed) {
		return (
			<button
				onClick={() => setIsCollapsed(false)}
				className="absolute top-4 right-4 z-50 w-10 h-10 rounded-full bg-background/80 backdrop-blur-md border border-white/10 shadow-xl flex items-center justify-center hover:bg-accent transition-all"
			>
				<Gemini.Color className="w-5 h-5 text-foreground" />
			</button>
		);
	}

	return (
		<div className="flex w-full h-full bg-background/60 backdrop-blur-xl border border-white/10 shadow-2xl rounded-xl overflow-hidden text-foreground font-sans antialiased">
			<div className="flex-1 flex flex-col min-w-0 bg-background/40">
				<AgentChatSection onClose={() => setIsCollapsed(true)} />
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
