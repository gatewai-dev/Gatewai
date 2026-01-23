import { createContext, type PropsWithChildren, useContext } from "react";
import type { AgentSessionsRPC } from "@/rpc/types";
import { useGetCanvasAgentSessionListQuery } from "@/store/agent-sessions";

type CanvasAgentSessionsContextType = {
	agentSessionsList: AgentSessionsRPC | undefined;
};

const CanvasAgentSessionsContext = createContext<
	CanvasAgentSessionsContextType | undefined
>(undefined);

const CanvasAgentSessionsProvider = ({
	children,
	canvasId,
}: PropsWithChildren & {
	canvasId: string;
}) => {
	const { data: agentSessionsList } = useGetCanvasAgentSessionListQuery({
		param: { id: canvasId },
	});

	return (
		<CanvasAgentSessionsContext.Provider
			value={{
				agentSessionsList,
			}}
		>
			{children}
		</CanvasAgentSessionsContext.Provider>
	);
};

export function useAgentSessionsCtx() {
	const ctx = useContext(CanvasAgentSessionsContext);
	if (!ctx) {
		throw new Error("useCanvasCtx should used inside CanvasProvider");
	}
	return ctx;
}

export { CanvasAgentSessionsContext, CanvasAgentSessionsProvider };
