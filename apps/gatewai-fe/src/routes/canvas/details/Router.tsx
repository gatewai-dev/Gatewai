import { Route, Routes } from "react-router";
import { VideoCompositorView } from "../../../modules/video-editor/video-compose-view";
import { CanvasDetailsRoot } from ".";
import { CompositorView } from "./nodes/compose/compositor-view";
import { ReactflowContainer } from "./reactflow-container";

function CanvasDetailsRouter() {
	return (
		<Routes>
			<Route path="" element={<CanvasDetailsRoot />}>
				<Route path="/" element={<ReactflowContainer />} />
				<Route path="/designer/:nodeId" element={<CompositorView />} />
				<Route path="/video-editor/:nodeId" element={<VideoCompositorView />} />
			</Route>
		</Routes>
	);
}

export { CanvasDetailsRouter };
