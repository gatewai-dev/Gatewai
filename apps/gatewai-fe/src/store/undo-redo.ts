import type { Reducer, UnknownAction } from "@reduxjs/toolkit";
import type { RootState } from ".";

export const BATCH_ACTION_TYPE = "flow/batched";

export const batchActions = (actions: UnknownAction[]) => ({
	type: BATCH_ACTION_TYPE,
	payload: actions,
});

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
		if (action.type === "flow/undo") {
			if (past.length === 0) return state;
			const previous = past[past.length - 1];
			const newPast = past.slice(0, past.length - 1);
			return {
				past: newPast,
				present: previous,
				future: [present, ...future],
			};
		}
		if (action.type === "flow/redo") {
			if (future.length === 0) return state;
			const next = future[0];
			const newFuture = future.slice(1);
			return {
				past: [...past, present],
				present: next,
				future: newFuture,
			};
		}
		const isBatched = action.type === BATCH_ACTION_TYPE;
		const actionsToProcess = isBatched
			? (action.payload as UnknownAction[])
			: [action];

		// Determine if we should record history
		// For batches, we check if the batch itself or any action inside it is "undoable"
		const isUndoable = config.undoableActionTypes
			? config.undoableActionTypes.includes(action.type as string)
			: true;

		// Calculate the next "present" state by running all actions
		let newPresent = present;
		for (const subAction of actionsToProcess) {
			newPresent = reducer(newPresent, subAction);
		}

		if (present === newPresent) return state;

		if (!isUndoable) {
			return { ...state, present: newPresent };
		}
		// Save to history once, regardless of how many actions were in the batch
		let newPast = [...past, present];
		if (config.limit && newPast.length > config.limit) {
			newPast = newPast.slice(newPast.length - config.limit);
		}

		return {
			past: newPast,
			present: newPresent,
			future: [],
		};
	};
}

export const selectCanUndo = (state: RootState) => state.flow.past.length > 0;
export const selectCanRedo = (state: RootState) => state.flow.future.length > 0;
