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
  },
})

// Extract the action creators object and the reducer
const { actions, reducer: nodesReducer } = nodesSlice
// Extract and export each action creator by name
export const { createNode, updateNode, deleteNode, setAllNodes} = actions
// Export the reducer, either as a default or named export
export { nodesReducer}