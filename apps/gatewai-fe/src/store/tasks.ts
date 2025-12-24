import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import { rpcClient } from '@/rpc/client'
import type { CanvasTaskListRPC, CanvasTaskListRPCParams } from '@/rpc/types';

// Define a service using a base URL and expected endpoints
export const tasksAPI = createApi({
    reducerPath: 'tasksAPI',
    baseQuery: fetchBaseQuery({
        baseUrl: `/api/v1/tasks`,
    }),
    endpoints: (build) => ({
        getCanvasTasks: build.query<CanvasTaskListRPC, CanvasTaskListRPCParams>({
            queryFn: async (params) => {
                const response = await rpcClient.api.v1.tasks[':canvasId'].$get(params);
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
export const { useGetCanvasTasksQuery } = tasksAPI