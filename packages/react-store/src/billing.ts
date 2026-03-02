import type {
	PricingPlanListRPC,
	SubscriptionRPC,
	UsageRecordRPC,
} from "@gatewai/rpc-client";
import { appRPCClient } from "@gatewai/rpc-client";
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

export type BalanceRPC = { tokens: number };

export const billingAPI = createApi({
	reducerPath: "billingAPI",
	baseQuery: fetchBaseQuery({
		baseUrl: "/api/v1/billing",
	}),
	tagTypes: ["Usage", "Plans", "Subscription", "Balance"],
	endpoints: (build) => ({
		getBalance: build.query<BalanceRPC, void>({
			providesTags: ["Balance"],
			query: () => "/balance",
		}),
		getUsage: build.query<UsageRecordRPC, void>({
			providesTags: ["Usage"],
			queryFn: async () => {
				const response = await appRPCClient.api.v1.billing.usage.$get();
				if (!response.ok) {
					return {
						error: { status: response.status, data: await response.text() },
					};
				}
				const data = await response.json();
				return { data };
			},
		}),
		getPlans: build.query<PricingPlanListRPC, void>({
			providesTags: ["Plans"],
			queryFn: async () => {
				const response = await appRPCClient.api.v1.billing.plans.$get();
				if (!response.ok) {
					return {
						error: { status: response.status, data: await response.text() },
					};
				}
				const data = await response.json();
				return { data };
			},
		}),
		getSubscription: build.query<SubscriptionRPC, void>({
			providesTags: ["Subscription"],
			queryFn: async () => {
				const response = await appRPCClient.api.v1.billing.subscription.$get();
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
	useGetBalanceQuery,
	useGetUsageQuery,
	useGetPlansQuery,
	useGetSubscriptionQuery,
} = billingAPI;
