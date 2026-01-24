import { Navigate, Route, Routes } from "react-router";
import { SigninPage } from "./signin";
import { SignupPage } from "./signup";

function AuthRouter() {
	return (
		<Routes>
			<Route index element={<Navigate to="signin" />} />
			<Route path="signin" element={<SigninPage />} />
			<Route path="registr" element={<SignupPage />} />
		</Routes>
	);
}

export { AuthRouter };
