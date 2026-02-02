import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router";
import { AuthLayout } from "../auth-layout";
import { SignInForm } from "./signin-form";

function SigninPage() {
	const nav = useNavigate();

	const onSuccess = () => {
		setTimeout(() => {
			nav("/canvas");
		}, 400);
	};

	return (
		<AuthLayout
			title="WELCOME BACK"
			subtitle="Sign in to continue building workflows"
		>
			<Helmet>
				<title>Sign In - Gatewai</title>
			</Helmet>
			<SignInForm onSuccess={onSuccess} />
		</AuthLayout>
	);
}

export { SigninPage };
