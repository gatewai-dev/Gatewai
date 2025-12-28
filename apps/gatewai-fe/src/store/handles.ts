import {
	createDraftSafeSelector,
	createEntityAdapter,
	createSlice,
} from "@reduxjs/toolkit";
import type { CanvasDetailsRPC } from "@/rpc/types";

export type HandleEntityType = CanvasDetailsRPC["handles"][number];

export const handleAdapter = createEntityAdapter({
	selectId: (handle: HandleEntityType) => handle.id,
});

const handlesSlice = createSlice({
	name: "handles",
	initialState: handleAdapter.getInitialState(),
	reducers: {
		createHandleEntity: handleAdapter.addOne,
		updateHandleEntity: handleAdapter.updateOne,
		deleteHandleEntity: handleAdapter.removeOne,
		deleteManyHandleEntity: handleAdapter.removeMany,
		addManyHandleEntities: handleAdapter.addMany,
		setAllHandleEntities: handleAdapter.setAll,
	},
});

type HandlesState = ReturnType<typeof handlesSlice.reducer>;

const handleSelectors = handleAdapter.getSelectors<{ handles: HandlesState }>(
	(state) => state.handles,
);

export const selectHandlesState = (state: { handles: HandlesState }) =>
	state.handles;

export const makeSelectHandleById = (id: string) => {
	return (state: { handles: HandlesState }) =>
		handleSelectors.selectById(state, id);
};
export const makeSelectHandlesByNodeId = (nodeId: string) =>
	createDraftSafeSelector(handleSelectors.selectAll, (handles) =>
		handles.filter((f) => f.nodeId === nodeId),
	);

export const makeSelectAllHandles = handleSelectors.selectAll;

// Extract the action creators object and the reducer
const { actions, reducer: handlesReducer } = handlesSlice;
// Extract and export each action creator by name
export const {
	createHandleEntity,
	updateHandleEntity,
	deleteHandleEntity,
	deleteManyHandleEntity,
	addManyHandleEntities,
	setAllHandleEntities,
} = actions;
// Export the reducer, either as a default or named export
export { handlesReducer, handleSelectors };
