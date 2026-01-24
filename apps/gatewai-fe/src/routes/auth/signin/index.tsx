import { useNavigate } from "react-router";
import { SignInForm } from "./signin-form";

function SigninPage() {
	const nav = useNavigate();

	const onSuccess = () => {
		nav('/canvas')
	}
	return <SignInForm onSuccess={onSuccess} />;
}

export { SigninPage };
