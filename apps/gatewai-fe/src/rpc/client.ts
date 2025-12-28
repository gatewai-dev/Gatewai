import { hc } from "hono/client";
import type { AppType } from "./../../backend/src/index";

const rpcClient = hc<AppType>("/", {
	init: {
		credentials: "include",
	},
});
export { rpcClient };
