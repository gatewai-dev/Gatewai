import { createAuthClient } from "better-auth/react";

import { getEnv } from "../utils/env";

const authClient = createAuthClient({
	baseURL: getEnv("VITE_BASE_URL"),

	fetchOptions: {
		credentials: "include",
	},
});

export { authClient };
