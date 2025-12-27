import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import { rpcClient } from '@/rpc/client'
import type { ActiveCanvasBatchListRPC, ActiveCanvasBatchListRPCParams, BatchDetailsRPC, BatchDetailsRPCParams } from '@/rpc/types';

// Define a service using a base URL and expected endpoints
export const tasksAPI = createApi({
    reducerPath: 'tasksAPI',
    baseQuery: fetchBaseQuery({
        baseUrl: `/api/v1/tasks`,
    }),
    endpoints: (build) => ({
        getActiveCanvasBatches: build.query<ActiveCanvasBatchListRPC, ActiveCanvasBatchListRPCParams>({
            queryFn: async (params) => {
                const response = await rpcClient.api.v1.tasks[':canvasId'].$get(params);
                if (!response.ok) {
                    return { error: { status: response.status, data: await response.text() } };
                }
                const data = await response.json();
                return { data };
            }
        }),
        getBatchDetails: build.query<BatchDetailsRPC, BatchDetailsRPCParams>({
            queryFn: async (params) => {
                const response = await rpcClient.api.v1.tasks["filterby-batch"].$get(params);
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
export const { useGetActiveCanvasBatchesQuery, useGetBatchDetailsQuery, useLazyGetBatchDetailsQuery } = tasksAPI