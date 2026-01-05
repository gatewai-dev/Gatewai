import type { AllNodeConfig, NodeResult, Output } from "@gatewai/types";
import {
	createDraftSafeSelector,
	createEntityAdapter,
	createSlice,
	type PayloadAction,
} from "@reduxjs/toolkit";
import { arrayEquals } from "@/lib/utils";
import type { CanvasDetailsRPC } from "@/rpc/types";
import { getBatchDetails } from "./tasks";

export type NodeEntityType = CanvasDetailsRPC["nodes"][number];

export const nodeAdapter = createEntityAdapter({
	selectId: (node: NodeEntityType) => node.id,
});

const nodesSlice = createSlice({
	name: "nodes",
	initialState: nodeAdapter.getInitialState<{
		selectedNodeIds: NodeEntityType["id"][] | null;
		loadingNodeIds: NodeEntityType["id"][];
	}>({
		selectedNodeIds: [],
		loadingNodeIds: [],
	}),
	reducers: {
		createNodeEntity: nodeAdapter.addOne,
		updateNodeEntity: nodeAdapter.updateOne,
		deleteNodeEntity: nodeAdapter.removeOne,
		deleteManyNodeEntity: nodeAdapter.removeMany,
		upsertManyNodeEntity: nodeAdapter.upsertMany,
		setAllNodeEntities: nodeAdapter.setAll,
		incrementSelectedResultIndex: (
			state,
			action: { payload: { id: string } },
		) => {
			const { id } = action.payload;
			const node = state.entities[id] as NodeEntityType;
			const result = node.result as {
				selectedOutputIndex?: number;
				outputs?: unknown[];
			};
			if (!result) {
				throw new Error("Node result is undefined");
			}
			if (node) {
				node.result = {
					...result,
					selectedOutputIndex: Math.min(
						(result?.selectedOutputIndex || 0) + 1,
						(result?.outputs?.length || 1) - 1,
					),
				};
			}
		},
		decrementSelectedResultIndex: (
			state,
			action: { payload: { id: string } },
		) => {
			const { id } = action.payload;
			const node = state.entities[id] as NodeEntityType;
			const result = node.result as {
				selectedOutputIndex?: number;
				outputs?: Output[];
			};
			if (!result) {
				throw new Error("Node result is undefined");
			}
			if (node) {
				node.result = {
					...result,
					selectedOutputIndex: Math.max(
						(result?.selectedOutputIndex || 0) - 1,
						0,
					),
				};
			}
		},
		updateNodeConfig: (
			state,
			action: { payload: { id: string; newConfig: Partial<AllNodeConfig> } },
		) => {
			const { id, newConfig } = action.payload;
			const node = state.entities[id];
			const existingConfig = node.config as AllNodeConfig;
			if (node) {
				node.config = {
					...existingConfig,
					...newConfig,
				};
			}
		},
		updateNodeResult: (
			state,
			action: { payload: { id: string; newResult: NodeResult } },
		) => {
			const { id, newResult } = action.payload;
			const node = state.entities[id];
			if (node) {
				node.result = newResult;
			}
		},
		setSelectedNodeIds: (
			state,
			action: PayloadAction<NodeEntityType["id"][] | null>,
		) => {
			if (!arrayEquals(state.selectedNodeIds ?? [], action.payload ?? [])) {
				state.selectedNodeIds = action.payload;
			}
		},
	},
	extraReducers(builder) {
		builder.addCase(getBatchDetails.fulfilled, (state, action) => {
			const { batches } = action.payload;
			const completedNodes: NodeEntityType[] = [];
			batches.forEach((batch) => {
				batch?.tasks.forEach((task) => {
					if (
						task.finishedAt &&
						task.status === "COMPLETED" &&
						task.node &&
						task.node.template.isTerminalNode
					) {
						completedNodes.push(task.node);
					}
				});
			});
			nodeAdapter.upsertMany(state, completedNodes);
		});
	},
});

type NodesState = ReturnType<typeof nodesSlice.reducer>;

const nodeSelectors = nodeAdapter.getSelectors<{ nodes: NodesState }>(
	(state) => state.nodes,
);

export const selectNodesState = (state: { nodes: NodesState }) => state.nodes;

export const selectNodeById = nodeSelectors.selectById;

export const makeSelectNodeById = (id: string) => {
	return (state: { nodes: NodesState }) => nodeSelectors.selectById(state, id);
};

export const makeSelectAllNodes = nodeSelectors.selectAll;
export const makeSelectAllNodeEntities = nodeSelectors.selectEntities;

export const selectSelectedNodeIds = createDraftSafeSelector(
	selectNodesState,
	(nodes) => nodes.selectedNodeIds,
);

export const selectLoadingNodeIds = createDraftSafeSelector(
	selectNodesState,
	(nodes) => nodes.loadingNodeIds,
);

export const selectSelectedNodes = createDraftSafeSelector(
	selectSelectedNodeIds,
	makeSelectAllNodes,
	(nodeIds, nodes) =>
		nodeIds ? nodes.filter((f) => nodeIds.includes(f.id)) : undefined,
);

// Extract the action creators object and the reducer
const { actions, reducer: nodesReducer } = nodesSlice;
// Extract and export each action creator by name
export const {
	createNodeEntity,
	updateNodeEntity,
	updateNodeResult,
	updateNodeConfig,
	deleteNodeEntity,
	deleteManyNodeEntity,
	upsertManyNodeEntity,
	setAllNodeEntities,
	incrementSelectedResultIndex,
	decrementSelectedResultIndex,
	setSelectedNodeIds,
} = actions;
// Export the reducer, either as a default or named export
export { nodesReducer, nodeSelectors };
