import {
	createContext,
	type PropsWithChildren,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState,
} from "react";
import type { AgentSessionsRPC } from "@/rpc/types";
import {
	useCreateCanvasAgentSessionMutation,
	useGetCanvasAgentSessionListQuery,
} from "@/store/agent-sessions";
import { useAgentChatStream } from "../hooks/use-agent-chat";

const SELECTED_MODEL_STORAGE_KEY = "canvas_agent_selected_model";
const DEFAULT_MODEL = "gemini-3-flash-preview";

export type MessageRole = "user" | "model" | "system";

export type MessageType =
	| "message"
	| "function_call"
	| "function_call_result"
	| "tool_call"
	| "patch_proposed"
	| "patch_action";

export interface ChatMessage {
	id: string;
	role: MessageRole;
	text: string;
	isStreaming?: boolean;
	createdAt: Date;
	eventType?: string;
	messageType?: MessageType;
	patchId?: string;
	patchStatus?: "PENDING" | "ACCEPTED" | "REJECTED";
}

type CanvasAgentContextType = {
	activeSessionId: string | null;
	setActiveSessionId: (id: string | null) => void;
	createNewSession: () => void;
	agentSessionsList: AgentSessionsRPC | undefined;
	isLoadingSessions: boolean;
	messages: ChatMessage[];
	sendMessage: (message: string) => Promise<void>;
	isLoading: boolean;
	stopGeneration: () => void;
	pendingPatchId: string | null;
	clearPendingPatch: () => void;
	selectedModel: string;
	setSelectedModel: (model: string) => void;
};

const CanvasAgentContext = createContext<CanvasAgentContextType | undefined>(
	undefined,
);

const CanvasAgentProvider = ({
	children,
	canvasId,
	initialSessionId = null,
}: PropsWithChildren & {
	canvasId: string;
	initialSessionId?: string | null;
}) => {
	const [activeSessionId, setActiveSessionId] = useState<string | null>(
		initialSessionId,
	);
	const [selectedModel, setSelectedModel] = useState<string>(() => {
		if (typeof window !== "undefined") {
			const saved = localStorage.getItem(SELECTED_MODEL_STORAGE_KEY);
			return saved || DEFAULT_MODEL;
		}
		return DEFAULT_MODEL;
	});

	// Track if component is mounted to prevent state updates after unmount
	const isMountedRef = useRef(true);

	useEffect(() => {
		isMountedRef.current = true;
		return () => {
			isMountedRef.current = false;
		};
	}, []);

	useEffect(() => {
		if (isMountedRef.current) {
			localStorage.setItem(SELECTED_MODEL_STORAGE_KEY, selectedModel);
		}
	}, [selectedModel]);

	const { data: agentSessionsList, isLoading: isLoadingSessions } =
		useGetCanvasAgentSessionListQuery({
			param: { id: canvasId },
		});

	const [createSession, { isLoading: isCreatingSession }] =
		useCreateCanvasAgentSessionMutation();

	const createNewSession = useCallback(async () => {
        try {
            // RTK Query's unwrap() is fine, but we can check if we still care about the result
            const res = await createSession({ param: { id: canvasId } }).unwrap();

				console.log('Act', res)
            if (res?.id) {
                setActiveSessionId(res.id);
            }
        } catch (e) {
			if (e instanceof Error) {
            	if (e.name !== 'AbortError') {
            	    console.error("Failed to create session", e);
            	}
			}
        }
    }, [canvasId, createSession]);

	useEffect(() => {
		if (isLoadingSessions || activeSessionId || isCreatingSession) return;
		if (agentSessionsList && agentSessionsList.length > 0) {
			const sortedSessions = [...agentSessionsList].sort(
				(a, b) =>
					new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
			);
			if (isMountedRef.current) {
				setActiveSessionId(sortedSessions[0].id);
			}
		} else {
			createNewSession();
		}
	}, [
		isLoadingSessions,
		agentSessionsList,
		activeSessionId,
		createNewSession,
		isCreatingSession,
	]);

	// Use the hook for chat logic
	const {
		messages,
		sendMessage,
		isLoading,
		stopGeneration,
		pendingPatchId,
		clearPendingPatch,
	} = useAgentChatStream(canvasId, activeSessionId || "", selectedModel);

	return (
		<CanvasAgentContext.Provider
			value={{
				activeSessionId,
				setActiveSessionId,
				createNewSession,
				agentSessionsList,
				isLoadingSessions,
				messages,
				sendMessage,
				isLoading,
				stopGeneration,
				pendingPatchId,
				clearPendingPatch,
				selectedModel,
				setSelectedModel,
			}}
		>
			{children}
		</CanvasAgentContext.Provider>
	);
};

export function useCanvasAgent() {
	const ctx = useContext(CanvasAgentContext);
	if (!ctx)
		throw new Error("useCanvasAgent must be used inside CanvasAgentProvider");
	return ctx;
}

export { CanvasAgentProvider };
