import { memo } from "react";
import { BottomPanel } from "./bottom-panel";
import { LeftPanel } from "./left-panel";
import { RightPanel } from "./right-panel";

const ReactFlowPanels = memo(() => {
	return (
		<>
			<LeftPanel />
			<RightPanel />
			<BottomPanel />
		</>
	);
});

export { ReactFlowPanels };
