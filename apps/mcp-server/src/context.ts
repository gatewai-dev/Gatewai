import { AsyncLocalStorage } from "node:async_hooks";
import type { GatewaiApiClient } from "@gatewai/api-client";

const apiStore = new AsyncLocalStorage<GatewaiApiClient>();

/**
 * Runs the callback with the provided API client in the async context.
 */
export const runWithApiClient = <T>(
	client: GatewaiApiClient,
	callback: () => T,
): T => {
	return apiStore.run(client, callback);
};

/**
 * Retrieves the current request-scoped API client.
 * Throws an error if called outside of a request context.
 */
export const getApiClient = (): GatewaiApiClient => {
	const client = apiStore.getStore();
	if (!client) {
		throw new Error("GatewaiApiClient accessed outside of request context");
	}
	return client;
};

/**
 * Safe retrieval that allows for a fallback client (e.g. global service account)
 * if no request context is present.
 */
export const getApiClientSafe = (): GatewaiApiClient => {
	const client = apiStore.getStore();
	if (!client) {
		throw new Error("GatewaiApiClient accessed outside of request context");
	}
	return client;
};
