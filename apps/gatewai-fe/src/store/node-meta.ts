import {
	createDraftSafeSelector,
	createSlice,
	type PayloadAction,
} from "@reduxjs/toolkit";
import { arrayEquals } from "@/lib/utils";
import type { NodeEntityType } from "./nodes";

export type NodeMetaState = {
	selectedNodeIds: NodeEntityType["id"][] | null;
	loadingNodeIds: NodeEntityType["id"][];
};

export const nodeMetaSlice = createSlice({
	name: "nodeMeta",
	initialState: {
		selectedNodeIds: [],
		loadingNodeIds: [],
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
	},
});

export const selectNodeMetaState = (state: { nodeMeta: NodeMetaState }) =>
	state.nodeMeta;

export const selectSelectedNodeIds = createDraftSafeSelector(
	selectNodeMetaState,
	(nodes) => nodes.selectedNodeIds,
);

export const selectLoadingNodeIds = createDraftSafeSelector(
	selectNodeMetaState,
	(nodes) => nodes.loadingNodeIds,
);

export const { actions: nodeMetaActions, reducer: nodeMetaReducer } =
	nodeMetaSlice;
export const { setSelectedNodeIds } = nodeMetaActions;
