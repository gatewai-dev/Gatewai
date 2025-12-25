import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import { rpcClient } from '@/rpc/client'
import type { CanvasDetailsRPC, CanvasDetailsRPCParams, PatchCanvasRPC, PatchCanvasRPCParams, ProcessNodesRPC, ProcessNodesRPCParams } from '@/rpc/types';

export const canvasDetailsAPI = createApi({
    reducerPath: 'canvasDetailsAPI',
    baseQuery: fetchBaseQuery({
        baseUrl: `/api/v1/canvas`,
    }),
    endpoints: (build) => ({
        getCanvasDetails: build.query<CanvasDetailsRPC, CanvasDetailsRPCParams>({
            queryFn: async (params) => {
                const response = await rpcClient.api.v1["canvas"][":id"].$get(params);
                if (!response.ok) {
                    return { error: { status: response.status, data: await response.text() } };
                }
                const data = await response.json();
                return { data };
            }
        }),
        patchCanvas: build.mutation<PatchCanvasRPC, PatchCanvasRPCParams>({
            queryFn: async (params) => {
                const response = await rpcClient.api.v1["canvas"][":id"].$patch(params);
                if (!response.ok) {
                    return { error: { status: response.status, data: await response.text() } };
                }
                const data = await response.json();
                return { data };
            }
        }),
        processNodesMutation: build.mutation<ProcessNodesRPC, ProcessNodesRPCParams>({
            queryFn: async (params) => {
                const response = await rpcClient.api.v1["canvas"][":id"]["process"].$post(params);
                if (!response.ok) {
                    return { error: { status: response.status, data: await response.text() } };
                }
                const data = await response.json();
                return { data };
            }
        }),
    }),
})

export const { useGetCanvasDetailsQuery, usePatchCanvasMutation, useProcessNodesMutationMutation } = canvasDetailsAPI