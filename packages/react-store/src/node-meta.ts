import {
	createDraftSafeSelector,
	createSlice,
	type PayloadAction,
} from "@reduxjs/toolkit";
import type { EdgeEntityType } from "./edges.js";
import type { NodeEntityType } from "./nodes.js";
import { arrayEquals } from "./utils.js";

export type NodeMetaState = {
	selectedNodeIds: NodeEntityType["id"][] | null;
	loadingNodeIds: NodeEntityType["id"][];
	selectedEdgeIds: EdgeEntityType["id"][];
};

export const nodeMetaSlice = createSlice({
	name: "nodeMeta",
	initialState: {
		selectedNodeIds: [],
		loadingNodeIds: [],
		selectedEdgeIds: [],
	} as NodeMetaState,
	reducers: {
		setSelectedNodeIds: (
			state,
			action: PayloadAction<NodeEntityType["id"][] | null>,
		) => {
			if (!arrayEquals(state.selectedNodeIds ?? [], action.payload ?? [])) {
				state.selectedNodeIds = action.payload;
			}
		},
		setSelectedEdgeIds: (
			state,
			action: PayloadAction<EdgeEntityType["id"][]>,
		) => {
			if (!arrayEquals(state.selectedEdgeIds ?? [], action.payload ?? [])) {
				state.selectedEdgeIds = action.payload;
			}
		},
	},
});

export const selectNodeMetaState = (state: { nodeMeta: NodeMetaState }) =>
	state.nodeMeta;

export const selectSelectedNodeIds = createDraftSafeSelector(
	selectNodeMetaState,
	(slice) => slice.selectedNodeIds,
);

export const selectSelectedEdgeIds = createDraftSafeSelector(
	selectNodeMetaState,
	(slice) => slice.selectedEdgeIds,
);

export const selectLoadingNodeIds = createDraftSafeSelector(
	selectNodeMetaState,
	(slice) => slice.loadingNodeIds,
);

export const { actions: nodeMetaActions, reducer: nodeMetaReducer } =
	nodeMetaSlice;
export const { setSelectedNodeIds, setSelectedEdgeIds } = nodeMetaActions;
