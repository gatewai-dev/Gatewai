import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import { rpcClient } from '@/rpc/client'
import type { UploadFileNodeAssetRPC, UploadFileNodeAssetRPCParams, UserAssetsListRPC, UserAssetsListRPCParams, UserAssetsUploadRPC } from '@/rpc/types';

// Define a service using a base URL and expected endpoints
export const assetsAPI = createApi({
    reducerPath: 'assetsAPI',
    baseQuery: fetchBaseQuery({
        baseUrl: `/api/v1/assets`,
    }),
    endpoints: (build) => ({
        getUserAssets: build.query<UserAssetsListRPC, UserAssetsListRPCParams>({
            queryFn: async ({ query }) => {
                const response = await rpcClient.api.v1.assets.$get({
                    query
                });
                const data = await response.json();
                return { data };
            }
        }),
        uploadAsset: build.mutation<UserAssetsUploadRPC, File>({
            queryFn: async (file) => {
                const form = { file };
                const response = await rpcClient.api.v1.assets.$post({
                    form
                });
                const data = await response.json();
                return { data };
            }
        }),
        uploadFileNodeAsset: build.mutation<UploadFileNodeAssetRPC, UploadFileNodeAssetRPCParams>({
            queryFn: async (payload) => {
                const response = await rpcClient.api.v1.assets.node[":nodeId"]["$post"](payload);
                const data = await response.json();
                return { data };
            }
        }),
    }),
})

// Export hooks for usage in functional components, which are
// auto-generated based on the defined endpoints
export const { useGetUserAssetsQuery, useUploadAssetMutation, useUploadFileNodeAssetMutation } = assetsAPI