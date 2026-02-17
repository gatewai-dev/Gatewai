import type {
	UploadFileNodeAssetRPC,
	UploadFileNodeAssetRPCParams,
	UserAssetsListRPC,
	UserAssetsListRPCParams,
	UserAssetsUploadRPC,
} from "@gatewai/rpc-client";
import { appRPCClient } from "@gatewai/rpc-client";
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";
import { canvasDetailsAPI } from "./canvas.js";

// Define a service using a base URL and expected endpoints
export const assetsAPI = createApi({
	reducerPath: "assetsAPI",
	tagTypes: ["getUserAssets"],
	baseQuery: fetchBaseQuery({
		baseUrl: `/api/v1/assets`,
	}),
	endpoints: (build) => ({
		getUserAssets: build.query<UserAssetsListRPC, UserAssetsListRPCParams>({
			queryFn: async ({ query }) => {
				const response = await appRPCClient.api.v1.assets.$get({
					query,
				});
				const data = await response.json();
				return { data };
			},
			providesTags: ["getUserAssets"],
		}),
		uploadAsset: build.mutation<UserAssetsUploadRPC, File>({
			queryFn: async (file) => {
				const form = { file };
				const response = await appRPCClient.api.v1.assets.$post({
					form,
				});
				const data = await response.json();
				return { data };
			},
			invalidatesTags: ["getUserAssets"],
		}),
		uploadFileNodeAsset: build.mutation<
			UploadFileNodeAssetRPC,
			UploadFileNodeAssetRPCParams
		>({
			queryFn: async (payload) => {
				const { param, form } = payload;
				const nodeId = param.nodeId;
				const formData = new FormData();
				formData.append("file", form.file);

				const response = await fetch(`/api/v1/nodes/File/upload/${nodeId}`, {
					method: "POST",
					body: formData,
				});

				if (!response.ok) {
					return {
						error: { status: response.status, data: await response.text() },
					};
				}

				const data = await response.json();
				return { data };
			},
			invalidatesTags: ["getUserAssets"],
		}),
		deleteAsset: build.mutation<void, string>({
			queryFn: async (id) => {
				const response = await appRPCClient.api.v1.assets[":id"].$delete({
					param: { id },
				});
				if (!response.ok) {
					throw new Error("Failed to delete asset");
				}
				return { data: undefined };
			},
			invalidatesTags: ["getUserAssets"],
			onQueryStarted: async (_arg, { dispatch, queryFulfilled }) => {
				try {
					await queryFulfilled;
					dispatch(canvasDetailsAPI.util.invalidateTags(["getCanvasDetails"]));
				} catch {
					// Ignore errors
				}
			},
		}),
	}),
});

// Export hooks for usage in functional components, which are
// auto-generated based on the defined endpoints
export const {
	useGetUserAssetsQuery,
	useUploadAssetMutation,
	useUploadFileNodeAssetMutation,
	useDeleteAssetMutation,
} = assetsAPI;
