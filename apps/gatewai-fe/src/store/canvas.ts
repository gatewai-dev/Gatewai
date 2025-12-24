import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import { rpcClient } from '@/rpc/client'
import type { CanvasListRPC, CanvasListRPCParams, CreateCanvasRPC, CreateCanvasRPCParams } from '@/rpc/types';

// Define a service using a base URL and expected endpoints
export const canvasListAPI = createApi({
    reducerPath: 'canvasListAPI',
    baseQuery: fetchBaseQuery({
        baseUrl: `/api/v1/canvas`,
    }),
    endpoints: (build) => ({
        getCanvasList: build.query<CanvasListRPC, CanvasListRPCParams>({
            queryFn: async (params) => {
                const response = await rpcClient.api.v1["canvas"].$get(params);
                if (!response.ok) {
                    return { error: { status: response.status, data: await response.text() } };
                }
                const data = await response.json();
                return { data };
            }
        }),
        createCanvas: build.mutation<CreateCanvasRPC, CreateCanvasRPCParams>({
            queryFn: async (params) => {
                const response = await rpcClient.api.v1["canvas"].$post(params);
                if (!response.ok) {
                    return { error: { status: response.status, data: await response.text() } };
                }
                const data = await response.json();
                return { data };
            }
        }),
    }),
})

// Export hooks for usage in functional components, which are
// auto-generated based on the defined endpoints
export const { useGetCanvasListQuery, useCreateCanvasMutation } = canvasListAPI