import {
	ReactflowContainer,
	useCanvasCtx,
	useNodePageComponent,
} from "@gatewai/react-canvas";
import { makeSelectNodeById, useAppSelector } from "@gatewai/react-store";
import { useCallback } from "react";
import { Route, Routes, useNavigate, useParams } from "react-router";

function NodePageView() {
	const { nodeId, canvasId } = useParams();
	const nav = useNavigate();
	const node = useAppSelector(makeSelectNodeById(nodeId));
	const PageComponent = useNodePageComponent(node?.type);
	const { moveViewportToNode } = useCanvasCtx();

	const handleClose = useCallback(() => {
		if (canvasId && nodeId) {
			nav(`/canvas/${canvasId}`);
			setTimeout(() => moveViewportToNode(nodeId), 100);
		}
	}, [nav, canvasId, nodeId, moveViewportToNode]);

	if (!node) return null;
	if (!PageComponent)
		return <div>Page component not found for node type: {node.type}</div>;

	return <PageComponent nodeId={nodeId!} closeCallback={handleClose} />;
}

function CanvasDetailsRouter() {
	return (
		<Routes>
			<Route path="" element={<CanvasDetailsRoot />}>
				<Route path="/" element={<ReactflowContainer />} />
				<Route path="/view/:nodeId" element={<NodePageView />} />
			</Route>
		</Routes>
	);
}

export { CanvasDetailsRouter };
