import type { JsonPatchOp } from "@gatewai/types";
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export interface PatchesState {
	pendingPatches: Record<string, JsonPatchOp[]>; // patchId -> ops
	activePreviewPatchId: string | null;
}

const initialState: PatchesState = {
	pendingPatches: {},
	activePreviewPatchId: null,
};

export const patchesSlice = createSlice({
	name: "patches",
	initialState,
	reducers: {
		addPatch: (
			state,
			action: PayloadAction<{ id: string; ops: JsonPatchOp[] }>,
		) => {
			state.pendingPatches[action.payload.id] = action.payload.ops;
		},
		removePatch: (state, action: PayloadAction<string>) => {
			delete state.pendingPatches[action.payload];
			if (state.activePreviewPatchId === action.payload) {
				state.activePreviewPatchId = null;
			}
		},
		setPreviewPatchId: (state, action: PayloadAction<string | null>) => {
			state.activePreviewPatchId = action.payload;
		},
	},
});

export const { addPatch, removePatch, setPreviewPatchId } =
	patchesSlice.actions;
export const patchesReducer = patchesSlice.reducer;
