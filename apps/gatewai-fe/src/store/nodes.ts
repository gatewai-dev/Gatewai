import type { CanvasDetailsRPC } from "@/rpc/types";
import { createEntityAdapter, createDraftSafeSelector, createSlice } from "@reduxjs/toolkit"

export type NodeEntityType = CanvasDetailsRPC["nodes"][number];

export const nodeAdapter = createEntityAdapter({
  selectId: (node: NodeEntityType) => node.id,
})

const nodesSlice = createSlice({
  name: 'nodes',
  initialState: nodeAdapter.getInitialState(),
  reducers: {
    createNode: nodeAdapter.addOne,
    updateNode: nodeAdapter.updateOne,
    deleteNode: nodeAdapter.removeOne,
    setAllNodes: nodeAdapter.setAll,
    updateTextNodeValue: (state, action: {payload: {id: string, value: string}}) => {
      const { id, value } = action.payload;
      const node = state.entities[id];
      if (node) {
        node.result = {
          parts: [{
            type: 'Text',
            data: value,
          }]
        };
      }
    },
    incrementSelectedResultIndex: (state, action: {payload: {id: string}}) => {
      const { id } = action.payload;
      const node = state.entities[id] as NodeEntityType;
      const result = node.result as { selectedIndex?: number; parts?: unknown[] };
      if (!result) {
        throw new Error("Node result is undefined");
      }
      if (node) {
        node.result = {
          ...result,
          selectedIndex: Math.min((result?.selectedIndex || 0) + 1, (result?.parts?.length || 1) - 1)
        };
      }
    },
    decrementSelectedResultIndex: (state, action: {payload: {id: string}}) => {
      const { id } = action.payload;
      const node = state.entities[id] as NodeEntityType;
      const result = node.result as { selectedIndex?: number; parts?: unknown[] };
      if (!result) {
        throw new Error("Node result is undefined");
      }
      if (node) {
        node.result = {
          ...result,
          selectedIndex: Math.max((result?.selectedIndex || 0) - 1, 0)
        };
      }
    },
  },
})

type NodesState = ReturnType<typeof nodesSlice.reducer>;

const nodeSelectors = nodeAdapter.getSelectors<{nodes: NodesState}>(
  (state) => state.nodes
);

export const selectNodesState = (state: { nodes: NodesState }) => state.nodes;

export const makeSelectNodeById = (id: string) => createDraftSafeSelector(
  selectNodesState,
  (nodes) => nodes.entities[id] as NodeEntityType | undefined
);

export const makeSelectAllNodes = () => nodeSelectors.selectAll;

// Extract the action creators object and the reducer
const { actions, reducer: nodesReducer } = nodesSlice
// Extract and export each action creator by name
export const { createNode, updateNode, deleteNode, setAllNodes, updateTextNodeValue, incrementSelectedResultIndex, decrementSelectedResultIndex } = actions
// Export the reducer, either as a default or named export
export { nodesReducer, nodeSelectors }