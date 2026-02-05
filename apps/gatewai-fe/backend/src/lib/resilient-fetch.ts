import { logger } from "../logger.js";

interface InternalFetchOptions extends RequestInit {
    timeout?: number;
    retries?: number;
    retryDelay?: number;
}

export const createResilientFetch = (defaultOptions: InternalFetchOptions = {}) => {
    const {
        timeout: defaultTimeout = 60000,
        retries: defaultRetries = 3,
        retryDelay: defaultRetryDelay = 1000,
    } = defaultOptions;

    return async (url: string | URL | Request, options: RequestInit = {}) => {
        const retries = (options as any).retries ?? defaultRetries;
        const retryDelay = (options as any).retryDelay ?? defaultRetryDelay;
        const timeout = (options as any).timeout ?? defaultTimeout;

        let lastError: any;

        for (let attempt = 0; attempt <= retries; attempt++) {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);

            // Chain existing signal if provided
            if (options.signal) {
                options.signal.addEventListener('abort', () => controller.abort());
            }

            try {
                const response = await fetch(url, {
                    ...options,
                    signal: controller.signal,
                    // @ts-expect-error - dispatcher is specific to undici/node-fetch environments
                    dispatcher: (options as any).dispatcher,
                });

                // Check for 5xx errors or 429 to retry
                if (response.status >= 500 || response.status === 429) {
                    throw new Error(`Request failed with status ${response.status}`);
                }

                return response;
            } catch (error: any) {
                lastError = error;
                const isAbort = error.name === 'AbortError';

                // Don't retry if it was explicitly aborted by the caller (and not our timeout)
                if (isAbort && options.signal?.aborted) {
                    throw error;
                }

                if (attempt < retries) {
                    const delay = retryDelay * Math.pow(2, attempt); // Exponential backoff
                    logger.warn({
                        msg: "Fetch attempt failed, retrying",
                        url: url.toString(),
                        attempt: attempt + 1,
                        error: error.message,
                        delay
                    });
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            } finally {
                clearTimeout(timeoutId);
            }
        }

        throw lastError;
    };
};
