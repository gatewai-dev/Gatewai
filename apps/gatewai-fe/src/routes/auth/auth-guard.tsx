import { authClient } from "@/lib/auth-client";
import type { ReactNode } from "react";
import { Navigate } from "react-router";

function AuthGuard({ children }: { children: ReactNode }) {
	const { data: session, isPending } = authClient.useSession();

	if (isPending) {
		return <>Loading...</>;
	}

	if (!session) {
		return <Navigate to="/signin" />;
	}
	return <>{children}</>;
}

export { AuthGuard };
