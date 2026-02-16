import { CanvasAgentLayout } from "@/agent/components/layout";
import { useCanvasCtx } from "@/canvas-ctx";

function AgentPanel() {
	const { canvas } = useCanvasCtx();
	if (!canvas) {
		return null;
	}
	return <CanvasAgentLayout canvasId={canvas.id} />;
}

export { AgentPanel };
