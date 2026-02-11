import { createRpcClient } from "@gatewai/rpc-client";
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

const rpcClient = createRpcClient();

import type { FontListRPC, FontListRPCParams } from "@gatewai/rpc-client";

export const fontListAPI = createApi({
	reducerPath: "fontListAPI",
	baseQuery: fetchBaseQuery({
		baseUrl: `/api/v1/fonts`,
	}),
	tagTypes: ["fontList"],
	endpoints: (build) => ({
		getFontList: build.query<FontListRPC, FontListRPCParams>({
			providesTags: ["fontList"],
			queryFn: async () => {
				const response = await rpcClient.api.v1.fonts.$get();
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

export const { useGetFontListQuery } = fontListAPI;
