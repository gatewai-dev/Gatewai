import { Panel } from "@xyflow/react";
import { CanvasAgentLayout } from "../../agent/components/layout";
import { useCanvasCtx } from "../../../../../../../../packages/react-canvas/src/canvas-ctx";

function AgentPanel() {
	const { canvas } = useCanvasCtx();
	if (!canvas) {
		return null;
	}
	return <CanvasAgentLayout canvasId={canvas.id} />;
}

export { AgentPanel };
