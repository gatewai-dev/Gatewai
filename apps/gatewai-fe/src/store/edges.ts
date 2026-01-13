import {
	createDraftSafeSelector,
	createEntityAdapter,
	createSlice,
} from "@reduxjs/toolkit";
import type { CanvasDetailsRPC } from "@/rpc/types";
import type { RootState } from ".";
import type { NodeEntityType } from "./nodes";

export type EdgeEntityType = CanvasDetailsRPC["edges"][number];

export const edgeAdapter = createEntityAdapter({
	selectId: (edge: EdgeEntityType) => edge.id,
});

const edgesSlice = createSlice({
	name: "edges",
	initialState: edgeAdapter.getInitialState(),
	reducers: {
		createEdgeEntity: edgeAdapter.addOne,
		updateEdgeEntity: edgeAdapter.updateOne,
		deleteManyEdgeEntity: edgeAdapter.removeMany,
		setAllEdgeEntities: edgeAdapter.setAll,
	},
});

export type EdgesState = ReturnType<typeof edgesSlice.reducer>;

const edgeSelectors = edgeAdapter.getSelectors<RootState>(
	(state) => state.flow.present.edges,
);

export const selectEdgesState = (state: RootState) => state.flow.present.edges;

export const makeSelectEdgeById = (id: string) => {
	return (state: RootState) => edgeSelectors.selectById(state, id);
};

export const makeSelectEdgesByIds = (ids: EdgeEntityType["id"][]) =>
	createDraftSafeSelector(edgeSelectors.selectAll, (edges) =>
		edges.filter(
			(f) => ids.includes(f.targetHandleId) || ids.includes(f.sourceHandleId),
		),
	);

export const makeSelectEdgesByTargetNodeId = (id: NodeEntityType["id"]) =>
	createDraftSafeSelector(edgeSelectors.selectAll, (edges) =>
		edges.filter((f) => f.target === id),
	);

export const makeSelectEdgesBySourceNodeId = (id: NodeEntityType["id"]) =>
	createDraftSafeSelector(edgeSelectors.selectAll, (edges) =>
		edges.filter((f) => f.source === id),
	);

export const makeSelectAllEdges = edgeSelectors.selectAll;

// Extract the action creators object and the reducer
const { actions, reducer: edgesReducer } = edgesSlice;
// Extract and export each action creator by name
export const {
	createEdgeEntity,
	updateEdgeEntity,
	setAllEdgeEntities,
	deleteManyEdgeEntity,
} = actions;
// Export the reducer, either as a default or named export
export { edgesReducer, edgeSelectors };
