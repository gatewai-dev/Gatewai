import { useState } from "react";

export function usePersistentState<T>(key: string, initialValue: T) {
	const [state, setState] = useState<T>(() => {
		try {
			const item = localStorage.getItem(key);
			return item ? JSON.parse(item) : initialValue;
		} catch {
			return initialValue;
		}
	});

	const setPersistentState = (value: T | ((val: T) => T)) => {
		try {
			const valueToStore = value instanceof Function ? value(state) : value;
			setState(valueToStore);
			localStorage.setItem(key, JSON.stringify(valueToStore));
		} catch (error) {
			console.error(error);
		}
	};

	return [state, setPersistentState] as const;
}
