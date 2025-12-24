import type { CanvasDetailsRPC } from "@/rpc/types";
import { createEntityAdapter, createDraftSafeSelector, createSlice } from "@reduxjs/toolkit"

export type EdgeEntityType = CanvasDetailsRPC["edges"][number];

export const edgeAdapter = createEntityAdapter({
  selectId: (edge: EdgeEntityType) => edge.id,
})

const edgesSlice = createSlice({
  name: 'edges',
  initialState: edgeAdapter.getInitialState(),
  reducers: {
    createEdgeEntity: edgeAdapter.addOne,
    updateEdgeEntity: edgeAdapter.updateOne,
    deleteEdgeEntity: edgeAdapter.removeOne,
    setAllEdgeEntities: edgeAdapter.setAll,
  },
})

type EdgesState = ReturnType<typeof edgesSlice.reducer>;

const edgeSelectors = edgeAdapter.getSelectors<{edges: EdgesState}>(
  (state) => state.edges
);

export const selectEdgesState = (state: { edges: EdgesState }) => state.edges;

export const makeSelectEdgeById = (id: string) => createDraftSafeSelector(
  selectEdgesState,
  (edges) => edges.entities[id] as EdgeEntityType | undefined
);

export const makeSelectAllEdges = edgeSelectors.selectAll;

// Extract the action creators object and the reducer
const { actions, reducer: edgesReducer } = edgesSlice
// Extract and export each action creator by name
export const { createEdgeEntity, updateEdgeEntity, deleteEdgeEntity, setAllEdgeEntities } = actions
// Export the reducer, either as a default or named export
export { edgesReducer, edgeSelectors }