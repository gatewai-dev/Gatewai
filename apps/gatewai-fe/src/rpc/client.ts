import { createRpcClient } from "@gatewai/rpc-client";

const rpcClient = createRpcClient("/", {
	credentials: "same-origin",
});
export { rpcClient };
