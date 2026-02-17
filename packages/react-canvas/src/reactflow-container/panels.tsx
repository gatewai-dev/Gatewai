import { Panel } from "@xyflow/react";
import { memo } from "react";
import { AgentPanel } from "./agent-panel";
import { BottomPanel } from "./bottom-panel";
import { DebugPanel } from "./debug-panel";
import { NodeConfigPanel } from "./right-panel/node-config";

// import { Panel } from "@xyflow/react";
// import { DebugPanel } from "../graph-engine/debug-panel";

const ReactFlowPanels = memo(({ children }: { children: React.ReactNode }) => {
	return (
		<>
			{children}
			<BottomPanel />
			<AgentPanel />
			<NodeConfigPanel />
			<Panel position="top-center">
				<DebugPanel />
			</Panel>
		</>
	);
});

export { ReactFlowPanels };
