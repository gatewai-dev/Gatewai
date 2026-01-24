import { Route, Routes } from "react-router";
import { CanvasDetailsRouter } from "./details/Router";
import { CanvasHome } from "./home";

function CanvasRouter() {
	return (
		<Routes>
			<Route index element={<CanvasHome />} />
			<Route path=":canvasId/*" element={<CanvasDetailsRouter />} />
		</Routes>
	);
}

export { CanvasRouter };
