import type { AgentSessionsRPC } from "@gatewai/react-store";
import { useGetCanvasAgentSessionListQuery } from "@gatewai/react-store";
import { createContext, type PropsWithChildren, useContext } from "react";

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
