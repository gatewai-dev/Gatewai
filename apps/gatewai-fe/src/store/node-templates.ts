import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import type { NodeTemplateWithIO } from '@/types/node-template'

// Define a service using a base URL and expected endpoints
export const nodeTemplatesAPI = createApi({
    reducerPath: 'nodeTemplatesAPI',
    baseQuery: fetchBaseQuery({ 
        baseUrl: `${import.meta.env.VITE_API_URL}/node-templates`,
    }),
    endpoints: (build) => ({
        getAllNodeTemplates: build.query<{templates: NodeTemplateWithIO[]}, null>({
            query: () => '',
        }),
    }),
})

// Export hooks for usage in functional components, which are
// auto-generated based on the defined endpoints
export const { useGetAllNodeTemplatesQuery } = nodeTemplatesAPI