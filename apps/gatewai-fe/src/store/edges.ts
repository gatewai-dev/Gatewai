import type { CanvasDetailsRPC } from "@/rpc/types";
import { createEntityAdapter, createDraftSafeSelector, createSlice, type PayloadAction } from "@reduxjs/toolkit"

export type EdgeEntityType = CanvasDetailsRPC["edges"][number];

export const edgeAdapter = createEntityAdapter({
  selectId: (edge: EdgeEntityType) => edge.id,
})

const edgesSlice = createSlice({
  name: 'edges',
  initialState: edgeAdapter.getInitialState<{ selectedEdgeIds: EdgeEntityType["id"][] | null }>({
    selectedEdgeIds: null,
  }),
  reducers: {
    createEdgeEntity: edgeAdapter.addOne,
    updateEdgeEntity: edgeAdapter.updateOne,
    deleteEdgeEntity: edgeAdapter.removeOne,
    setAllEdgeEntities: edgeAdapter.setAll,
    setSelectedEdgeIds: (state, action: PayloadAction<EdgeEntityType["id"][] | null>) => {
      state.selectedEdgeIds = action.payload;
    },
  },
})

type EdgesState = ReturnType<typeof edgesSlice.reducer>;

const edgeSelectors = edgeAdapter.getSelectors<{edges: EdgesState}>(
  (state) => state.edges
);

export const selectEdgesState = (state: { edges: EdgesState }) => state.edges;

export const makeSelectEdgeById = (id: EdgeEntityType["id"]) => createDraftSafeSelector(
  selectEdgesState,
  (edges) => edges.entities[id] as EdgeEntityType | undefined
);

export const makeSelectAllEdges = edgeSelectors.selectAll;

export const selectSelectedEdgeIds = createDraftSafeSelector(
  selectEdgesState,
  (edges) => edges.selectedEdgeIds
);

export const selectSelectedEdges = createDraftSafeSelector(
  selectSelectedEdgeIds,
  makeSelectAllEdges,
  (edgeIds, edges) => edgeIds? edges.filter(f => edgeIds.includes(f.id)) : undefined
);

// Extract the action creators object and the reducer
const { actions, reducer: edgesReducer } = edgesSlice
// Extract and export each action creator by name
export const { createEdgeEntity, updateEdgeEntity, deleteEdgeEntity, setAllEdgeEntities, setSelectedEdgeIds } = actions
// Export the reducer, either as a default or named export
export { edgesReducer, edgeSelectors }