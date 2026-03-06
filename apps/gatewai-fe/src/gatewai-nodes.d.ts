declare module "virtual:gatewai-nodes" {
	import type {
		FrontendNodePlugin,
		BackendNodePlugin,
		NodeMetadata,
	} from "@gatewai/node-sdk";

	export const discoveredNodes: Record<
		string,
		{
			metadata: () => Promise<{ metadata: Readonly<NodeMetadata> }>;
			browser: () => Promise<{ default: Readonly<FrontendNodePlugin> }>;
			server: () => Promise<{ default: Readonly<BackendNodePlugin> }>;
		}
	>;
}
