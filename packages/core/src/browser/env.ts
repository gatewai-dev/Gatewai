/**
 * Utility to safely access environment variables in the browser.
 * Prioritizes runtime values injected via /env.js over build-time VITE_ variables.
 */

declare global {
	interface Window {
		GATEWAI_ENV?: {
			VITE_BASE_URL?: string;
			DISABLE_EMAIL_SIGNUP?: boolean;
		};
	}
}

export function getEnv(
	key: keyof NonNullable<Window["GATEWAI_ENV"]>,
): string | boolean | undefined {
	// 1. Try runtime environment (injected via /env.js)
	if (
		typeof window !== "undefined" &&
		(window as any).GATEWAI_ENV &&
		(window as any).GATEWAI_ENV[key]
	) {
		return (window as any).GATEWAI_ENV[key];
	}

	// 2. Fallback to build-time environment (Vite)
	// @ts-expect-error
	const env = import.meta.env;
	if (env && env[key]) {
		return env[key];
	}

	return undefined;
}
