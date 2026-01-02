import { Route, Routes } from "react-router";
import { CanvasDetailsRoot } from ".";
import { CompositorView } from "./nodes/compose/compositor-view";
import { ReactflowContainer } from "./reactflow-container";

function CanvasDetailsRouter() {
	return (
		<Routes>
			<Route path="" element={<CanvasDetailsRoot />}>
				<Route path="/" element={<ReactflowContainer />} />
				<Route path="/designer/:nodeId" element={<CompositorView />} />
			</Route>
		</Routes>
	);
}

export { CanvasDetailsRouter };
