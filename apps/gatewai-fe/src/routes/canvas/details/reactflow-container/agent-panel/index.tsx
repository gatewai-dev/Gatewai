import { useCanvasCtx } from "@gatewai/react-canvas";
import { CanvasAgentLayout } from "../../agent/components/layout";

function AgentPanel() {
	const { canvas } = useCanvasCtx();
	if (!canvas) {
		return null;
	}
	return <CanvasAgentLayout canvasId={canvas.id} />;
}

export { AgentPanel };
