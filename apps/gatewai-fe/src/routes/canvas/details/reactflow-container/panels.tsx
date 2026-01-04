import { Panel } from "@xyflow/react";
import { memo } from "react";
import { NodePalette } from "../../node-templates/node-palette";
import { RightPanel } from "./right-panel";
import { Toolbar } from "./toolbar";
import { TopPanel } from "./top-panel";

const ReactFlowPanels = memo(() => {
	return (
		<>
			<Panel
				position="top-left"
				className=" bg-background left-0 top-0 m-0! h-full flex flex-col"
			>
				<NodePalette />
			</Panel>
			<TopPanel />
			<RightPanel />
			<Panel position="bottom-center">
				<Toolbar />
			</Panel>
		</>
	);
});

export { ReactFlowPanels };
