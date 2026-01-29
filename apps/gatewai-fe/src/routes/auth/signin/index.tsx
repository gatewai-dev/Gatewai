import { useNavigate } from "react-router";
import { SignInForm } from "./signin-form";

function SigninPage() {
	const nav = useNavigate();

	const onSuccess = () => {
		setTimeout(() => {
			nav("/canvas");
		}, 400);
	};
	return <SignInForm onSuccess={onSuccess} />;
}

export { SigninPage };
