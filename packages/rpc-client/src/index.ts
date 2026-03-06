import { createRpcClient } from "./factory";

export * from "./factory";
export * from "./rpc-types";

const appRPCClient = createRpcClient("/", {
	credentials: "same-origin",
});

export { appRPCClient };
