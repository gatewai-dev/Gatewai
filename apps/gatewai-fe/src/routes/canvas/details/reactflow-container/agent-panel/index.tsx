import { Panel } from "@xyflow/react";
import { CanvasAgentLayout } from "../../agent/components/layout";
import { useCanvasCtx } from "../../ctx/canvas-ctx";

function AgentPanel() {
	const { canvas } = useCanvasCtx();
	if (!canvas) {
		return null;
	}
	return (
		<Panel className="h-full" position="top-right">
			<CanvasAgentLayout canvasId={canvas.id} />
		</Panel>
	);
}

export { AgentPanel };
