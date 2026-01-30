import { Link, useNavigate } from "react-router";
import { AuthLayout } from "../auth-layout";
import { SignUpForm } from "./signup-form";

function SignupPage() {
	const nav = useNavigate();

	const onSuccess = () => {
		setTimeout(() => {
			nav("/canvas");
		}, 400);
	};
	return (
		<AuthLayout
			title="CREATE ACCOUNT"
			subtitle="Start building AI workflows today"
		>
			<SignUpForm onSuccess={onSuccess} />
			<div className="text-center text-sm text-zinc-500 mt-4">
				Already have an account?{" "}
				<Link
					to="/auth/signin"
					className="font-semibold text-primary hover:text-primary/80 transition-colors"
				>
					Sign in
				</Link>
			</div>
		</AuthLayout>
	);
}

export { SignupPage };
