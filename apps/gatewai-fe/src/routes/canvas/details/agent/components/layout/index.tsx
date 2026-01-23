import { CanvasAgentProvider } from "../../ctx/canvas-agent.ctx";
import { AgentSessionList } from "../agent-session-list";
import { AgentChatSection } from "../chat-section";

// Assuming you have a page component
export function CanvasAgentLayout({ canvasId }: { canvasId: string }) {
  return (
    <CanvasAgentProvider canvasId={canvasId}>
      <div className="flex h-[420px] w-full bg-background text-foreground font-sans antialiased overflow-hidden">
        {/* Sidebar */}
        <AgentSessionList className="hidden md:flex shrink-0 w-64" />

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col min-w-0 border-l">
          {/* You might want a mobile toggle for the sidebar here */}
          <AgentChatSection canvasId={canvasId} />
        </div>
      </div>
    </CanvasAgentProvider>
  );
}