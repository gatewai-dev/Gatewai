import type { Node as DBNode } from "@gatewai/types"
import { createEntityAdapter, createSlice } from "@reduxjs/toolkit"

const nodeAdapter = createEntityAdapter({
  selectId: (node: DBNode) => node.id,
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
  },
})

// Extract the action creators object and the reducer
const { actions, reducer: nodesReducer } = nodesSlice
// Extract and export each action creator by name
export const { createNode, updateNode, deleteNode, setAllNodes, updateTextNodeValue } = actions
// Export the reducer, either as a default or named export
export { nodesReducer}