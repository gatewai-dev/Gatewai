import { getEnv } from "@gatewai/core/browser";
import { polarClient } from "@polar-sh/better-auth/client";
import { apiKeyClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

const enablePricing = getEnv("VITE_ENABLE_PRICING");

const authClient = createAuthClient({
	baseURL: getEnv("VITE_BASE_URL") as string,
	plugins: [apiKeyClient(), ...(enablePricing ? [polarClient()] : [])],
	fetchOptions: {
		credentials: "include",
	},
});

export { authClient };
