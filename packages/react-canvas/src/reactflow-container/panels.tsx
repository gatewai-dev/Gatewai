import { memo } from "react";
import { AgentPanel } from "./agent-panel";
import { BottomPanel } from "./bottom-panel";
import { LeftPanel } from "./left-panel";
import { NodeConfigPanel } from "./right-panel/node-config";

// import { Panel } from "@xyflow/react";
// import { DebugPanel } from "../graph-engine/debug-panel";

const ReactFlowPanels = memo(() => {
	return (
		<>
			<LeftPanel />
			<BottomPanel />
			<AgentPanel />
			<NodeConfigPanel />
			{/* <Panel position="top-center">
				<DebugPanel />
			</Panel> */}
		</>
	);
});

export { ReactFlowPanels };
