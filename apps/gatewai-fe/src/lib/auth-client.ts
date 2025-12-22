import { createAuthClient } from "better-auth/client"


const authClient = createAuthClient({
    baseURL: import.meta.env.VITE_BASE_URL,
    fetchOptions: {
        credentials: "include",
    },
})

export { authClient };
