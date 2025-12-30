import {
	createDraftSafeSelector,
	createEntityAdapter,
	createSlice,
	type PayloadAction,
} from "@reduxjs/toolkit";
import type { CanvasDetailsRPC } from "@/rpc/types";
import type { NodeEntityType } from "./nodes";

export type EdgeEntityType = CanvasDetailsRPC["edges"][number];

export const edgeAdapter = createEntityAdapter({
	selectId: (edge: EdgeEntityType) => edge.id,
});

const edgesSlice = createSlice({
	name: "edges",
	initialState: edgeAdapter.getInitialState<{
		selectedEdgeIds: EdgeEntityType["id"][] | null;
	}>({
		selectedEdgeIds: null,
	}),
	reducers: {
		createEdgeEntity: edgeAdapter.addOne,
		updateEdgeEntity: edgeAdapter.updateOne,
		deleteManyEdgeEntity: edgeAdapter.removeMany,
		deleteEdgeEntity: edgeAdapter.removeOne,
		setAllEdgeEntities: edgeAdapter.setAll,
		setSelectedEdgeIds: (
			state,
			action: PayloadAction<EdgeEntityType["id"][] | null>,
		) => {
			state.selectedEdgeIds = action.payload;
		},
	},
});

type EdgesState = ReturnType<typeof edgesSlice.reducer>;

const edgeSelectors = edgeAdapter.getSelectors<{ edges: EdgesState }>(
	(state) => state.edges,
);

export const selectEdgesState = (state: { edges: EdgesState }) => state.edges;

export const makeSelectEdgeById = (id: string) => {
	return (state: { edges: EdgesState }) => edgeSelectors.selectById(state, id);
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

export const selectSelectedEdgeIds = createDraftSafeSelector(
	selectEdgesState,
	(edges) => edges.selectedEdgeIds,
);

export const selectSelectedEdges = createDraftSafeSelector(
	selectSelectedEdgeIds,
	edgeSelectors.selectAll,
	(edgeIds, edges) =>
		edgeIds ? edges.filter((f) => edgeIds.includes(f.id)) : undefined,
);

// Extract the action creators object and the reducer
const { actions, reducer: edgesReducer } = edgesSlice;
// Extract and export each action creator by name
export const {
	createEdgeEntity,
	updateEdgeEntity,
	deleteEdgeEntity,
	setAllEdgeEntities,
	deleteManyEdgeEntity,
	setSelectedEdgeIds,
} = actions;
// Export the reducer, either as a default or named export
export { edgesReducer, edgeSelectors };
