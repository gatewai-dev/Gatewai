import {
	createSelector,
	createSlice,
	type PayloadAction,
} from "@reduxjs/toolkit";
import {
	addEdge,
	applyEdgeChanges as applyEdgeChangesBase,
	applyNodeChanges as applyNodeChangesBase,
	type Edge,
	type EdgeChange,
	type Node,
	type NodeChange,
} from "@xyflow/react";
import type { RootState } from ".";

interface RFState {
	nodes: Node[];
	edges: Edge[];
}

const initialState: RFState = {
	nodes: [],
	edges: [],
};

const reactFlowSlice = createSlice({
	name: "reactFlow",
	initialState,
	reducers: {
		setNodes: (state, action: PayloadAction<Node[]>) => {
			state.nodes = action.payload;
		},
		setEdges: (state, action: PayloadAction<Edge[]>) => {
			state.edges = action.payload;
		},
		createNode: (state, action: PayloadAction<Node>) => {
			state.nodes = [...state.nodes, action.payload];
		},
		createEdge: (state, action: PayloadAction<Edge>) => {
			state.edges = [...state.edges, action.payload];
		},
		onNodeChange: (state, action: PayloadAction<NodeChange<Node>[]>) => {
			state.nodes = applyNodeChangesBase(action.payload, state.nodes);
		},
		onNodeDragStop: (state, action: PayloadAction<NodeChange<Node>[]>) => {
			state.nodes = applyNodeChangesBase(action.payload, state.nodes);
		},
		onEdgeChange: (state, action: PayloadAction<EdgeChange<Edge>[]>) => {
			state.edges = applyEdgeChangesBase(action.payload, state.edges);
		},
		addConnection: (state, action: PayloadAction<Edge>) => {
			state.edges = addEdge(action.payload, state.edges);
		},
	},
});

export const {
	createNode,
	createEdge,
	setNodes,
	setEdges,
	addConnection,
	onNodeChange,
	onEdgeChange,
} = reactFlowSlice.actions;

export const selectRFState = (state: RootState) => state.flow.present.reactFlow;

export const selectRFNodes = createSelector(
	selectRFState,
	(state) => state.nodes,
);
export const selectRFEdges = createSelector(
	selectRFState,
	(state) => state.edges,
);

export const reactFlowReducer = reactFlowSlice.reducer;
