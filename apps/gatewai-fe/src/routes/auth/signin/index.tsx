import { Link, useNavigate } from "react-router";
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
			<SignInForm onSuccess={onSuccess} />
			<div className="text-center text-sm text-zinc-500 mt-4">
				Don&apos;t have an account?{" "}
				<Link
					to="/auth/signup"
					className="font-semibold text-primary hover:text-primary/80 transition-colors"
				>
					Sign up
				</Link>
			</div>
		</AuthLayout>
	);
}

export { SigninPage };
