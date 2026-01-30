import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { rpcClient } from "@/rpc/client";
import type {
	CanvasListRPC,
	CanvasListRPCParams,
	CreateCanvasRPC,
	CreateCanvasRPCParams,
} from "@/rpc/types";

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
		deleteCanvas: build.mutation<void, string>({
			invalidatesTags: ["canvasList"],
			queryFn: async (id) => {
				const response = await rpcClient.api.v1.canvas[":id"].$delete({
					param: { id },
				});
				if (!response.ok) {
					return {
						error: { status: response.status, data: await response.text() },
					};
				}
				const data = await response.json();
				return { data: undefined };
			},
		}),
	}),
});

export const {
	useGetCanvasListQuery,
	useCreateCanvasMutation,
	useDeleteCanvasMutation,
} = canvasListAPI;
