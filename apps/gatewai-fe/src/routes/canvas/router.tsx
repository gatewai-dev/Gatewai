import { Route, Routes } from "react-router";
import { CanvasDetails } from "./details";
import { CanvasDetailsRouter } from "./details/Router";

function CanvasRouter() {
	return (
		<Routes>
			<Route path=":canvasId/*" element={<CanvasDetailsRouter />} />
		</Routes>
	);
}

export { CanvasRouter };
