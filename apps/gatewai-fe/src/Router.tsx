import { Route, Routes } from "react-router";
import { CanvasHome } from "./routes/canvas/home";
import { CanvasRouter } from "./routes/canvas/router";

function AppRouter() {
	return (
		<Routes>
			<Route index element={<CanvasHome />} />
			<Route path="/canvas/*" element={<CanvasRouter />} />
		</Routes>
	);
}

export { AppRouter };
