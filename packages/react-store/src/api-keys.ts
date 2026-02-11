import { createRpcClient } from "@gatewai/rpc-client";
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

const rpcClient = createRpcClient();

export const apiKeysAPI = createApi({
	reducerPath: "apiKeysAPI",
	tagTypes: ["getApiKeys"],
	baseQuery: fetchBaseQuery({
		baseUrl: `/api/v1/api-keys`,
	}),
	endpoints: (build) => ({
		getApiKeys: build.query<
			{
				keys: {
					id: string;
					name: string;
					start: string;
					createdAt: string;
					lastUsedAt: string | null;
					prefix: string;
				}[];
			},
			void
		>({
			queryFn: async () => {
				const response = await rpcClient.api.v1["api-keys"].$get();
				if (!response.ok) {
					throw new Error("Failed to fetch API keys");
				}
				const data = await response.json();
				return {
					data: {
						keys: data.keys.map((k) => ({
							...k,
							name: k.name ?? "",
							start: k.start ?? "",
							prefix: k.prefix ?? "",
							lastUsedAt: k.lastUsedAt ?? null, // Keep null if allowed by type
						})),
					},
				};
			},
			providesTags: ["getApiKeys"],
		}),
		createApiKey: build.mutation<
			{ key: { id: string; name: string }; fullKey: string },
			{ name: string }
		>({
			queryFn: async ({ name }) => {
				const response = await rpcClient.api.v1["api-keys"].$post({
					json: { name },
				});
				if (!response.ok) {
					throw new Error("Failed to create API key");
				}
				const data = await response.json();
				return {
					data: {
						...data,
						key: { ...data.key, name: data.key.name ?? "" },
					},
				};
			},
			invalidatesTags: ["getApiKeys"],
		}),
		deleteApiKey: build.mutation<void, string>({
			queryFn: async (id) => {
				const response = await rpcClient.api.v1["api-keys"][":id"].$delete({
					param: { id },
				});
				if (!response.ok) {
					const errorData = await response.json();
					throw new Error(errorData.error || "Failed to delete API key");
				}
				return { data: undefined };
			},
			invalidatesTags: ["getApiKeys"],
		}),
	}),
});

export const {
	useGetApiKeysQuery,
	useCreateApiKeyMutation,
	useDeleteApiKeyMutation,
} = apiKeysAPI;
