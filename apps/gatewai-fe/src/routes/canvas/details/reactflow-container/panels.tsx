import { Panel } from "@xyflow/react";
import { memo } from "react";
import { LeftPanel } from "./left-panel";
import { RightPanel } from "./right-panel";
import { Toolbar } from "./toolbar";

const ReactFlowPanels = memo(() => {
	return (
		<>
			<LeftPanel />
			<RightPanel />
			<Panel position="bottom-center">
				<Toolbar />
			</Panel>
		</>
	);
});

export { ReactFlowPanels };
