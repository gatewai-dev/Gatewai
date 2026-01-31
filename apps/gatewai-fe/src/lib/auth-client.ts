import { createAuthClient } from "better-auth/react";

import { getEnv } from "./env";

const authClient = createAuthClient({
	baseURL: getEnv("VITE_BASE_URL"),

	fetchOptions: {
		credentials: "include",
	},
});

export { authClient };
