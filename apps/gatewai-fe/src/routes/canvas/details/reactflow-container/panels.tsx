import { Panel } from "@xyflow/react";
import { memo } from "react";
import { CanvasAgentLayout } from "../agent/components/layout";
import { useCanvasCtx } from "../ctx/canvas-ctx";
import { DebugPanel } from "../graph-engine/debug-panel";
import { BottomPanel } from "./bottom-panel";
import { LeftPanel } from "./left-panel";
import { NodeConfigPanel } from "./right-panel/node-config";

const ReactFlowPanels = memo(() => {
	const { canvas } = useCanvasCtx();
	return (
		<>
			<LeftPanel />
			<NodeConfigPanel />
			<BottomPanel />
			{canvas && (
				<Panel position="bottom-right">
					<CanvasAgentLayout canvasId={canvas.id} />
				</Panel>
			)}
			<Panel position="top-center">
				<DebugPanel />
			</Panel>
		</>
	);
});

export { ReactFlowPanels };
