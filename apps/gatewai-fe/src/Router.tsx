import { Route, Routes } from "react-router";
import { AuthGuard } from "./routes/auth/auth-guard";
import { AuthRouter } from "./routes/auth/router";
import { CanvasHome } from "./routes/canvas/home";
import { CanvasRouter } from "./routes/canvas/router";

function AppRouter() {
	return (
		<Routes>
			<Route
				index
				element={
					<AuthGuard>
						<CanvasHome />
					</AuthGuard>
				}
			/>
			<Route
				path="/canvas/*"
				element={
					<AuthGuard>
						<CanvasRouter />
					</AuthGuard>
				}
			/>
			<Route path="*" element={<AuthRouter />} />
		</Routes>
	);
}

export { AppRouter };
