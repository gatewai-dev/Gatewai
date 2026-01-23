import { 
  createContext, 
  type PropsWithChildren, 
  useContext, 
  useState, 
  useCallback 
} from "react";
import type { AgentSessionsRPC, AgentSessionEntity } from "@/rpc/types";
import { useGetCanvasAgentSessionListQuery } from "@/store/agent-sessions";


type CanvasAgentContextType = {
  // Session Management
  activeSessionId: string | null;
  setActiveSessionId: (id: string | null) => void;
  createNewSession: () => void;
  
  // Data
  agentSessionsList: AgentSessionsRPC | undefined;
  isLoadingSessions: boolean;
};

const CanvasAgentContext = createContext<CanvasAgentContextType | undefined>(
  undefined
);


const CanvasAgentProvider = ({
  children,
  canvasId,
  initialSessionId = null
}: PropsWithChildren & {
  canvasId: string;
  initialSessionId?: string | null;
}) => {
  const [activeSessionId, setActiveSessionId] = useState<string | null>(initialSessionId);

  const { 
    data: agentSessionsList, 
    isLoading: isLoadingSessions 
  } = useGetCanvasAgentSessionListQuery({
    param: { id: canvasId },
  });

  const createNewSession = useCallback(() => {
    // Generate a client-side ID for immediate UI optimistic updates
    // The backend will persist this when the first message is sent
    const newId = crypto.randomUUID();
    setActiveSessionId(newId);
  }, []);

  return (
    <CanvasAgentContext.Provider
      value={{
        activeSessionId,
        setActiveSessionId,
        createNewSession,
        agentSessionsList,
        isLoadingSessions
      }}
    >
      {children}
    </CanvasAgentContext.Provider>
  );
};


export function useCanvasAgent() {
  const ctx = useContext(CanvasAgentContext);
  if (!ctx) {
    throw new Error("useCanvasAgent must be used inside CanvasAgentProvider");
  }
  return ctx;
}

export { CanvasAgentProvider };