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
	}),
});

export const { useGetCanvasListQuery, useCreateCanvasMutation } = canvasListAPI;
