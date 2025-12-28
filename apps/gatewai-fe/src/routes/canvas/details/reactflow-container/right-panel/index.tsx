import { memo } from "react";
import { DebugPanel } from "../../processor/debug-panel";
import { NodeConfigPanel } from "./node-config";

const RightPanel = memo(() => {
	return (
		<div className="border-0 bg-background p-4 rounded-md shadow-md flex flex-col justify-between grow">
			<div>
				<NodeConfigPanel />
			</div>
			<DebugPanel />
		</div>
	);
});

export { RightPanel };
