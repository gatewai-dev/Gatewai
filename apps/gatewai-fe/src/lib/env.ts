/**
 * Utility to safely access environment variables.
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
	if (window.GATEWAI_ENV && window.GATEWAI_ENV[key]) {
		return window.GATEWAI_ENV[key];
	}

	// 2. Fallback to build-time environment (Vite)
	return import.meta.env[key];
}
