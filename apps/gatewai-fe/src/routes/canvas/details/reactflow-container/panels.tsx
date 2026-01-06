import { memo } from "react";
import { BottomPanel } from "./bottom-panel";
import { LeftPanel } from "./left-panel";
import { NodeConfigPanel } from "./right-panel/node-config";

const ReactFlowPanels = memo(() => {
	return (
		<>
			<LeftPanel />
			<NodeConfigPanel />
			<BottomPanel />
		</>
	);
});

export { ReactFlowPanels };
