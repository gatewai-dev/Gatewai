import { createRpcClient } from "@gatewai/rpc-client";
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

const rpcClient = createRpcClient();

import type {
	CanvasListRPC,
	CanvasListRPCParams,
	CreateCanvasRPC,
	CreateCanvasRPCParams,
	DeleteCanvasRPC,
	DeleteCanvasRPCParams,
} from "@gatewai/rpc-client";

export const canvasListAPI = createApi({
	reducerPath: "canvasListAPI",
	baseQuery: fetchBaseQuery({
		baseUrl: `/api/v1/canvas`,
	}),
	tagTypes: ["canvasList"],
	endpoints: (build) => ({
		getCanvasList: build.query<CanvasListRPC, CanvasListRPCParams>({
			providesTags: ["canvasList"],
			queryFn: async (params) => {
				const response = await rpcClient.api.v1.canvas.$get(params);
				if (!response.ok) {
					return {
						error: { status: response.status, data: await response.text() },
					};
				}
				const data = await response.json();
				return { data };
			},
		}),
		createCanvas: build.mutation<CreateCanvasRPC, CreateCanvasRPCParams>({
			invalidatesTags: ["canvasList"],
			queryFn: async (params) => {
				const response = await rpcClient.api.v1.canvas.$post(params);
				if (!response.ok) {
					return {
						error: { status: response.status, data: await response.text() },
					};
				}
				const data = await response.json();
				return { data };
			},
		}),
		deleteCanvas: build.mutation<DeleteCanvasRPC, DeleteCanvasRPCParams>({
			invalidatesTags: ["canvasList"],
			queryFn: async (param) => {
				const response = await rpcClient.api.v1.canvas[":id"].$delete(param);
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
	useGetCanvasListQuery,
	useCreateCanvasMutation,
	useDeleteCanvasMutation,
} = canvasListAPI;
