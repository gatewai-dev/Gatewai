/// <reference types="vite/client" />

declare module "virtual:gatewai-nodes" {
	import type { DiscoveredNodeRegistry } from "@gatewai/react-canvas";
	export const discoveredNodes: DiscoveredNodeRegistry;
}
