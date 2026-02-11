import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { createRpcClient } from "@gatewai/rpc-client";

const rpcClient = createRpcClient();
import type {
	ApplyPatchRPC,
	ApplyPatchRPCParams,
	CanvasDetailsRPC,
	CanvasDetailsRPCParams,
	GetPatchRPC,
	GetPatchRPCParams,
	PatchCanvasRPC,
	PatchCanvasRPCParams,
	ProcessNodesRPC,
	ProcessNodesRPCParams,
	RejectPatchRPC,
	RejectPatchRPCParams,
	UpdateCanvasNameRPC,
	UpdateCanvasNameRPCParams,
} from "@gatewai/rpc-client";

export const canvasDetailsAPI = createApi({
	reducerPath: "canvasDetailsAPI",
	baseQuery: fetchBaseQuery({
		baseUrl: `/api/v1/canvas`,
	}),
	tagTypes: ["getCanvasDetails"],
	endpoints: (build) => ({
		getCanvasDetails: build.query<CanvasDetailsRPC, CanvasDetailsRPCParams>({
			providesTags: ["getCanvasDetails"],
			queryFn: async (params) => {
				const response = await rpcClient.api.v1.canvas[":id"].$get(params);
				if (!response.ok) {
					return {
						error: { status: response.status, data: await response.text() },
					};
				}
				const data = await response.json();
				return { data };
			},
		}),
		patchCanvas: build.mutation<PatchCanvasRPC, PatchCanvasRPCParams>({
			queryFn: async (params) => {
				const response = await rpcClient.api.v1.canvas[":id"].$patch(params);
				if (!response.ok) {
					return {
						error: { status: response.status, data: await response.text() },
					};
				}
				const data = await response.json();
				return { data };
			},
		}),
		updateName: build.mutation<UpdateCanvasNameRPC, UpdateCanvasNameRPCParams>({
			invalidatesTags: ["getCanvasDetails"],
			queryFn: async (params) => {
				const response =
					await rpcClient.api.v1.canvas[":id"]["update-name"].$patch(params);
				if (!response.ok) {
					return {
						error: { status: response.status, data: await response.text() },
					};
				}
				const data = await response.json();
				return { data };
			},
		}),
		processNodes: build.mutation<ProcessNodesRPC, ProcessNodesRPCParams>({
			queryFn: async (params) => {
				const response =
					await rpcClient.api.v1.canvas[":id"].process.$post(params);
				if (!response.ok) {
					return {
						error: { status: response.status, data: await response.text() },
					};
				}
				const data = await response.json();
				return { data };
			},
		}),
		getPatch: build.query<GetPatchRPC, GetPatchRPCParams>({
			queryFn: async (params) => {
				const response =
					await rpcClient.api.v1.canvas[":id"].patches[":patchId"].$get(params);
				if (!response.ok) {
					return {
						error: { status: response.status, data: await response.text() },
					};
				}
				const data = await response.json();
				return { data };
			},
		}),
		applyPatch: build.mutation<ApplyPatchRPC, ApplyPatchRPCParams>({
			invalidatesTags: ["getCanvasDetails"],
			queryFn: async (params) => {
				const response =
					await rpcClient.api.v1.canvas[":id"].patches[":patchId"].apply.$post(
						params,
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
		rejectPatch: build.mutation<RejectPatchRPC, RejectPatchRPCParams>({
			invalidatesTags: ["getCanvasDetails"],
			queryFn: async (params) => {
				const response =
					await rpcClient.api.v1.canvas[":id"].patches[":patchId"].reject.$post(
						params,
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
	useGetCanvasDetailsQuery,
	usePatchCanvasMutation,
	useProcessNodesMutation,
	useUpdateNameMutation,
	useGetPatchQuery,
	useApplyPatchMutation,
	useRejectPatchMutation,
	useLazyGetPatchQuery,
} = canvasDetailsAPI;
