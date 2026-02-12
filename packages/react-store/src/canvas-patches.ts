import type { CanvasPatch } from "@gatewai/db";
import {
	createEntityAdapter,
	createSlice,
	type PayloadAction,
} from "@reduxjs/toolkit";
import type { RootState } from "./index.js";

export const patchAdapter = createEntityAdapter<CanvasPatch>();

export type PatchesState = ReturnType<typeof patchesSlice.reducer>;

export const patchesSlice = createSlice({
	name: "patches",
	initialState: patchAdapter.getInitialState<{
		activePreviewPatchId: string | null;
	}>({
		activePreviewPatchId: null,
	}),
	reducers: {
		addPatch: (state, action: PayloadAction<CanvasPatch>) => {
			patchAdapter.addOne(state, action.payload);
		},
		removePatch: (state, action: PayloadAction<string>) => {
			patchAdapter.removeOne(state, action.payload);
			if (state.activePreviewPatchId === action.payload) {
				state.activePreviewPatchId = null;
			}
		},
		setPreviewPatchId: (state, action: PayloadAction<string | null>) => {
			state.activePreviewPatchId = action.payload;
		},
	},
});

const patchSelectors = patchAdapter.getSelectors<RootState>(
	(state) => state.canvasPatches,
);

export const selectCanvasPatchById = patchSelectors.selectById;

export const makeSelectCanvasPatchById = (id: string) => {
	return (state: RootState) => patchSelectors.selectById(state, id);
};

export const makeSelectAllCanvasPatchs = patchSelectors.selectAll;
export const makeSelectAllCanvasPatchEntities = patchSelectors.selectEntities;

const { actions: patchActions, reducer: canvasPatchesReducer } = patchesSlice;
export const { addPatch, removePatch, setPreviewPatchId } = patchActions;
export { canvasPatchesReducer, patchSelectors };
