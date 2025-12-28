import { Navigate, Route, Routes } from "react-router";
import { SigninPage } from "./signin";

function AuthRouter() {
	return (
		<Routes>
			<Route index element={<Navigate to="signin" />} />
			<Route path="signin" element={<SigninPage />} />
		</Routes>
	);
}

export { AuthRouter };
