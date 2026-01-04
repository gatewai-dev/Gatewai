import { Panel } from "@xyflow/react";
import { memo } from "react";
import { DebugPanel } from "../../processor/debug-panel";
import { NodeConfigPanel } from "./node-config";

const RightPanel = memo(() => {
	return (
		<Panel
			position="bottom-right"
			className="bg-background right-0 top-0 m-0! h-full flex flex-col"
		>
			<div className="border-0 bg-background p-4 rounded-md shadow-md flex flex-col justify-between grow">
				<div>
					<NodeConfigPanel />
				</div>
				<DebugPanel />
			</div>
		</Panel>
	);
});

export { RightPanel };
