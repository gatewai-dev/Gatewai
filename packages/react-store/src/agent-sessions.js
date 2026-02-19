import { appRPCClient } from "@gatewai/rpc-client";
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
export const agentSessionsAPI = createApi({
	reducerPath: "agentSessionsAPI",
	baseQuery: fetchBaseQuery({
		baseUrl: `/api/v1/canvas/`,
	}),
	tagTypes: ["agentSessionList"],
	endpoints: (build) => ({
		getCanvasAgentSessionList: build.query({
			providesTags: ["agentSessionList"],
			queryFn: async (payload) => {
				const response =
					await appRPCClient.api.v1.canvas[":id"].agent.sessions.$get(payload);
				if (!response.ok) {
					return {
						error: { status: response.status, data: await response.text() },
					};
				}
				const data = await response.json();
				return { data };
			},
		}),
		getCanvasAgentSessionDetails: build.query({
			queryFn: async (payload) => {
				const response =
					await appRPCClient.api.v1.canvas[":id"].agent[":sessionId"].$get(
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
		createCanvasAgentSession: build.mutation({
			invalidatesTags: ["agentSessionList"],
			queryFn: async (payload) => {
				const response =
					await appRPCClient.api.v1.canvas[":id"].agent.sessions.$post(payload);
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
	useCreateCanvasAgentSessionMutation,
} = agentSessionsAPI;
