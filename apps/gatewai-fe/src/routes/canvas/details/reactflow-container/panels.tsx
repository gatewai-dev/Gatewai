import { Panel } from "@xyflow/react";
import { memo } from "react";
import { DebugPanel } from "../graph-engine/debug-panel";
import { BottomPanel } from "./bottom-panel";
import { LeftPanel } from "./left-panel";
import { NodeConfigPanel } from "./right-panel/node-config";
import { AgentPanel } from "./agent-panel";

const ReactFlowPanels = memo(() => {
	return (
		<>
			<LeftPanel />
			<NodeConfigPanel />
			<BottomPanel />
			<AgentPanel />
			<Panel position="top-center">
				<DebugPanel />
			</Panel>
		</>
	);
});

export { ReactFlowPanels };
