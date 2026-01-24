import { Route, Routes } from "react-router";
import { AuthGuard } from "./routes/auth/auth-guard";
import { AuthRouter } from "./routes/auth/router";
import { CanvasRouter } from "./routes/canvas/router";
import { HomePage } from "./routes/home";

function AppRouter() {
	return (
		<Routes>
			<Route path="" element={<HomePage />} />
			<Route path="/auth/*" element={<AuthRouter />} />
			<Route
				path="/canvas/*"
				element={
					<AuthGuard>
						<CanvasRouter />
					</AuthGuard>
				}
			/>
		</Routes>
	);
}

export { AppRouter };
