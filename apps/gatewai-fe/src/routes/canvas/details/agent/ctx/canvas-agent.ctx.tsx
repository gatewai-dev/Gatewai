import { createContext, type PropsWithChildren } from "react";
import type { AgentSessionDetailsRPC, AgentSessionEntity } from "@/rpc/types";
import { useGetCanvasAgentSessionDetailsQuery } from "@/store/agent-sessions";

type CanvasAgentContextType = {
	agentSession: AgentSessionDetailsRPC | undefined;
};

const CanvasAgentContext = createContext<CanvasAgentContextType | undefined>(
	undefined,
);

const CanvasAgentProvider = ({
	children,
	sessionId,
	canvasId,
}: PropsWithChildren & {
	sessionId: AgentSessionEntity["id"];
	canvasId: string;
}) => {
	const { data: agentSession } = useGetCanvasAgentSessionDetailsQuery(
		{
			param: {
				id: canvasId,
				sessionId: sessionId,
			},
		},
		{
			skip: sessionId == null,
		},
	);

	return (
		<CanvasAgentContext.Provider
			value={{
				agentSession,
			}}
		>
			{children}
		</CanvasAgentContext.Provider>
	);
};

export { CanvasAgentContext, CanvasAgentProvider };
