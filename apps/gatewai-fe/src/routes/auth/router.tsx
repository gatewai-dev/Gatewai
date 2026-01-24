import { Navigate, Route, Routes } from "react-router";
import { SigninPage } from "./signin";
import { SignupPage } from "./signup";

function AuthRouter() {
	return (
		<Routes>
			<Route index element={<Navigate to="signin" />} />
			<Route path="signin" element={<SigninPage />} />
			<Route path="ddddddddd1çö23104ç" element={<SignupPage />} />
		</Routes>
	);
}

export { AuthRouter };
