import { createRpcClient } from "@gatewai/rpc-client";
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

const rpcClient = createRpcClient();

import type { NodeTemplateListRPC } from "@gatewai/rpc-client";

// Define a service using a base URL and expected endpoints
export const nodeTemplatesAPI = createApi({
	reducerPath: "nodeTemplatesAPI",
	baseQuery: fetchBaseQuery({
		baseUrl: `/api/v1/node-templates`,
	}),
	endpoints: (build) => ({
		getAllNodeTemplates: build.query<NodeTemplateListRPC, null>({
			queryFn: async () => {
				const response = await rpcClient.api.v1["node-templates"].$get();
				if (!response.ok) {
					return {
						error: { status: response.status, data: await response.text() },
					};
				}
				const data = await response.json();
				return { data };
			},
		}),
	}),
});

// Export hooks for usage in functional components, which are
// auto-generated based on the defined endpoints
export const { useGetAllNodeTemplatesQuery } = nodeTemplatesAPI;
