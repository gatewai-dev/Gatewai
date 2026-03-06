import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Checks if two arrays are shallowly equal.
 * Best for: string[], number[], boolean[]
 */
export const arrayEquals = <T>(a: T[], b: T[]): boolean => {
	return (
		Array.isArray(a) &&
		Array.isArray(b) &&
		a.length === b.length &&
		a.every((val, index) => val === b[index])
	);
};

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}
