import { logger } from "@gatewai/core";

interface InternalFetchOptions extends RequestInit {
	timeout?: number;
	retries?: number;
	retryDelay?: number;
	dispatcher?: any;
}

export const createResilientFetch = (
	defaultOptions: InternalFetchOptions = {},
) => {
	const {
		timeout: defaultTimeout = 60000,
		retries: defaultRetries = 3,
		retryDelay: defaultRetryDelay = 1000,
	} = defaultOptions;

	return async (
		url: string | URL | Request,
		options: InternalFetchOptions = {},
	) => {
		const {
			retries = defaultRetries,
			retryDelay = defaultRetryDelay,
			timeout = defaultTimeout,
			dispatcher,
			signal,
			...fetchOptions
		} = options;

		let lastError: any;

		for (let attempt = 0; attempt <= retries; attempt++) {
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), timeout);

			const onAbort = () => controller.abort();
			// Chain existing signal if provided
			if (signal) {
				signal.addEventListener("abort", onAbort, { once: true });
			}

			try {
				const response = await fetch(url, {
					...fetchOptions,
					signal: controller.signal,
					dispatcher,
				} as RequestInit & { dispatcher?: any });

				// Check for 5xx errors or 429 to retry
				if (response.status >= 500 || response.status === 429) {
					throw new Error(`Request failed with status ${response.status}`);
				}

				return response;
			} catch (error: any) {
				lastError = error;
				const isAbort = error.name === "AbortError";

				// Don't retry if it was explicitly aborted by the caller (and not our timeout)
				if (isAbort && signal?.aborted) {
					throw error;
				}

				if (attempt < retries) {
					const delay = retryDelay * 2 ** attempt; // Exponential backoff
					logger.warn({
						msg: "Fetch attempt failed, retrying",
						url: url.toString(),
						attempt: attempt + 1,
						error: error.message,
						delay,
					});
					await new Promise((resolve) => setTimeout(resolve, delay));
				}
			} finally {
				clearTimeout(timeoutId);
				if (signal) {
					signal.removeEventListener("abort", onAbort);
				}
			}
		}

		throw lastError;
	};
};
