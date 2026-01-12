import type { Reducer, UnknownAction } from "@reduxjs/toolkit";
import type { RootState } from ".";

export interface HistoryState<S> {
	past: S[];
	present: S;
	future: S[];
}

interface UndoConfig {
	limit?: number;
	undoableActionTypes?: string[];
}

export function undoReducer<S>(
	reducer: Reducer<S>,
	config: UndoConfig = {},
): Reducer<HistoryState<S>> {
	const initialState: HistoryState<S> = {
		past: [],
		present: reducer(undefined, { type: "@@INIT" } as UnknownAction),
		future: [],
	};

	return (state = initialState, action: UnknownAction): HistoryState<S> => {
		const { past, present, future } = state;

		switch (action.type) {
			case "flow/undo": {
				if (past.length === 0) return state;
				const previous = past[past.length - 1];
				const newPast = past.slice(0, past.length - 1);
				return {
					past: newPast,
					present: previous,
					future: [present, ...future],
				};
			}

			case "flow/redo": {
				if (future.length === 0) return state;
				const next = future[0];
				const newFuture = future.slice(1);
				return {
					past: [...past, present],
					present: next,
					future: newFuture,
				};
			}

			default: {
				const newPresent = reducer(present, action);
				if (present === newPresent) return state;

				const isUndoable = config.undoableActionTypes
					? config.undoableActionTypes.includes(action.type as string)
					: true;

				if (!isUndoable) {
					return { ...state, present: newPresent };
				}

				let newPast = [...past, present];
				if (config.limit && newPast.length > config.limit) {
					newPast = newPast.slice(newPast.length - config.limit);
				}

				return {
					past: newPast,
					present: newPresent,
					future: [],
				};
			}
		}
	};
}

export const selectCanUndo = (state: RootState) => state.flow.past.length > 0;
export const selectCanRedo = (state: RootState) => state.flow.future.length > 0;
