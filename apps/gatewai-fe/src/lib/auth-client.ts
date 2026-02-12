import { apiKeyClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

import { getEnv } from "./env";

const authClient = createAuthClient({
	baseURL: getEnv("VITE_BASE_URL") as string,
	plugins: [apiKeyClient()],
	fetchOptions: {
		credentials: "include",
	},
});

export { authClient };
