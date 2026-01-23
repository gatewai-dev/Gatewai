import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { SendHorizontal, StopCircle, Sparkles, User } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { useCanvasAgent } from "../../ctx/canvas-agent.ctx";
import { useAgentChatStream } from "../../hooks/use-agent-chat";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MarkdownRenderer } from "../../../components/markdown-renderer";

interface AgentChatSectionProps {
  canvasId: string;
}

export function AgentChatSection({ canvasId }: AgentChatSectionProps) {
  const { activeSessionId } = useCanvasAgent();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Local state for input
  const [inputValue, setInputValue] = useState("");

  // Use the streaming hook we created
  const { messages, sendMessage, isLoading, stopGeneration } = useAgentChatStream(
    canvasId,
    activeSessionId || ""
  );

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleSubmit = async () => {
    if (!inputValue.trim() || !activeSessionId) return;
    const msg = inputValue;
    setInputValue(""); // Clear immediately
    await sendMessage(msg);
  };

  if (!activeSessionId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-background text-muted-foreground">
        <Sparkles className="w-12 h-12 mb-4 text-muted" />
        <p>Select or create a chat to begin</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-background h-full relative overflow-hidden">
      {/* --- Chat History --- */}
      <ScrollArea
        className="flex-1 p-6 space-y-6"
        ref={scrollRef}
      >
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center opacity-40">
            <h3 className="text-lg font-medium text-foreground">How can I help?</h3>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              "flex w-full",
              msg.role === "user" ? "justify-end" : "justify-start"
            )}
          >
            <div
              className={cn(
                "flex max-w-[80%] gap-3",
                msg.role === "user" ? "flex-row-reverse" : "flex-row"
              )}
            >
              {/* Avatar */}
              {/*<Avatar className="flex-shrink-0">
                <AvatarFallback
                  className={cn(
                    msg.role === "user"
                      ? "bg-muted border-border"
                      : "bg-primary/10 border-primary/20"
                  )}
                >
                  {msg.role === "user" ? (
                    <User className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <Sparkles className="w-4 h-4 text-primary" />
                  )}
                </AvatarFallback>
              </Avatar> */}

              {/* Bubble */}
              <div
                className={cn(
                  "px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm",
                  msg.role === "user"
                    ? "bg-foreground text-background rounded-tr-sm"
                    : "bg-card border text-foreground rounded-tl-sm"
                )}
              >
                {msg.role === "user" ? (
                  <div className="whitespace-pre-wrap">{msg.text}</div>
                ) : (
                  <MarkdownRenderer markdown={msg.text} />
                )}

                {msg.isStreaming && (
                  <span className="inline-block w-1.5 h-4 ml-1 bg-primary animate-pulse align-middle" />
                )}
              </div>
            </div>
          </div>
        ))}
      </ScrollArea>

      {/* --- Input Area --- */}
      <div className="p-4 bg-background/80 backdrop-blur-md border-t sticky bottom-0 z-10">
        <div className="max-w-3xl mx-auto relative flex items-end gap-2 p-2 bg-muted rounded-xl border focus-within:ring-2 focus-within:ring-primary/10 focus-within:border-primary transition-all shadow-sm">
          <Textarea
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything..."
            className="w-full bg-transparent border-0 focus:ring-0 resize-none min-h-[44px] max-h-32 py-2.5 px-2 text-sm placeholder:text-muted-foreground"
            rows={1}
          />

          <div className="pb-1 pr-1">
            {isLoading ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={stopGeneration}
                className="bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                aria-label="Stop generation"
              >
                <StopCircle className="w-5 h-5" />
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSubmit}
                disabled={!inputValue.trim()}
                className="bg-foreground text-background hover:bg-foreground/90 disabled:bg-muted disabled:text-muted-foreground transition-colors shadow-sm"
                aria-label="Send message"
              >
                <SendHorizontal className="w-5 h-5" />
              </Button>
            )}
          </div>
        </div>
        <div className="text-center mt-2">
          <p className="text-[10px] text-muted-foreground">AI can make mistakes. Check important info.</p>
        </div>
      </div>
    </div>
  );
}