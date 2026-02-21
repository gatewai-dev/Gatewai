import { getEnv } from "@gatewai/core/browser";
import { apiKeyClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

const authClient = createAuthClient({
	baseURL: getEnv("VITE_BASE_URL") as string,
	plugins: [apiKeyClient()],
	fetchOptions: {
		credentials: "include",
	},
});

export { authClient };
