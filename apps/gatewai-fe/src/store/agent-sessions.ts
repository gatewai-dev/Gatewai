import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { rpcClient } from "@/rpc/client";
import type {
	AgentSessionDetailsRPC,
	AgentSessionDetailsRPCParams,
	AgentSessionsRPC,
	AgentSessionsRPCParams,
} from "@/rpc/types";

export const agentSessionsAPI = createApi({
	reducerPath: "agentSessionsAPI",
	baseQuery: fetchBaseQuery({
		baseUrl: `/api/v1/canvas/`,
	}),
	tagTypes: ["agentSessionList"],
	endpoints: (build) => ({
		getCanvasAgentSessionList: build.query<
			AgentSessionsRPC,
			AgentSessionsRPCParams
		>({
			providesTags: ["agentSessionList"],
			queryFn: async (payload) => {
				const response =
					await rpcClient.api.v1.canvas[":id"].agent.sessions.$get(payload);
				if (!response.ok) {
					return {
						error: { status: response.status, data: await response.text() },
					};
				}
				const data = await response.json();
				return { data };
			},
		}),
		getCanvasAgentSessionDetails: build.query<
			AgentSessionDetailsRPC,
			AgentSessionDetailsRPCParams
		>({
			queryFn: async (payload) => {
				const response =
					await rpcClient.api.v1.canvas[":id"].agent[":sessionId"].$get(
						payload,
					);
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

export const {
	useGetCanvasAgentSessionListQuery,
	useGetCanvasAgentSessionDetailsQuery,
} = agentSessionsAPI;
