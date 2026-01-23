import {
	createContext,
	type PropsWithChildren,
	useContext,
	useEffect,
	useState,
} from "react";
import type { AgentSessionsRPC } from "@/rpc/types";
import { useGetCanvasAgentSessionListQuery } from "@/store/agent-sessions";

type CanvasAgentSessionsContextType = {
	agentSessionsList: AgentSessionsRPC | undefined;
	isLocked: boolean;
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

	const [isLocked, setIsLocked] = useState(false);

	useEffect(() => {
		const eventSource = new EventSource(
			`/api/v1/canvas/${canvasId}/agent/events`,
		);

		eventSource.onmessage = (event) => {
			try {
				const data = JSON.parse(event.data);
				if (data.type === "LOCK_STATUS") {
					setIsLocked(data.isLocked);
				}
			} catch (e) {
				console.error("Error parsing SSE data", e);
			}
		};

		return () => {
			eventSource.close();
		};
	}, [canvasId]);

	return (
		<CanvasAgentSessionsContext.Provider
			value={{
				agentSessionsList,
				isLocked,
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
