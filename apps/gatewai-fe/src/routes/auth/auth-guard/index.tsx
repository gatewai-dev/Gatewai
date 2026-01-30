import type { ReactNode } from "react";
import { Navigate } from "react-router";
import { authClient } from "@/lib/auth-client";

function AuthGuard({ children }: { children: ReactNode }) {
	const { data: session, isPending } = authClient.useSession();

	if (isPending) {
		return <>Loading...</>;
	}

	if (!session) {
		return <Navigate replace={false} to="/auth/signin" />;
	}
	return <>{children}</>;
}

export { AuthGuard };
