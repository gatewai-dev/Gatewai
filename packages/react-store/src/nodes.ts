import { isEqual } from "@gatewai/core";
import type { NodeResult } from "@gatewai/core/types";
import type { CanvasDetailsRPC } from "@gatewai/rpc-client";
import { createRpcClient } from "@gatewai/rpc-client";
import {
	createDraftSafeSelector,
	createEntityAdapter,
	createSlice,
} from "@reduxjs/toolkit";

import type { RootState } from "./index.js";
import { selectSelectedNodeIds } from "./node-meta.js";
import { getBatchDetails } from "./tasks.js";

export type NodeEntityType = CanvasDetailsRPC["nodes"][number];

export const nodeAdapter = createEntityAdapter<NodeEntityType>();

export const nodesSlice = createSlice({
	name: "nodes",
	initialState: nodeAdapter.getInitialState(),
	reducers: {
		createNodeEntity: nodeAdapter.addOne,
		updateNodeEntity: nodeAdapter.updateOne,
		deleteManyNodeEntity: nodeAdapter.removeMany,
		setAllNodeEntities: nodeAdapter.setAll,
		updateNodeConfigWithoutHistory: (
			state,
			action: { payload: { id: string; newConfig: Partial<any> } },
		) => {
			const { id, newConfig } = action.payload;
			const node = state.entities[id];
			const existingConfig = node.config as any;
			if (node) {
				node.config = {
					...existingConfig,
					...newConfig,
				} as unknown as typeof node.config;
			}
		},
		updateNodeConfig: (
			state,
			action: { payload: { id: string; newConfig: Partial<any> } },
		) => {
			const { id, newConfig } = action.payload;
			const node = state.entities[id];
			const existingConfig = node.config as any;
			if (node) {
				node.config = {
					...existingConfig,
					...newConfig,
				} as unknown as typeof node.config;
			}
		},
		updateNodeResult: (
			state,
			action: { payload: { id: string; newResult: NodeResult } },
		) => {
			const { id, newResult } = action.payload;
			const node = state.entities[id];
			if (node) {
				node.result = newResult as unknown as typeof node.result;
			}
		},
	},
	extraReducers(builder) {
		builder.addCase(getBatchDetails.fulfilled, (state, action) => {
			const batches = action.payload;
			const completedNodes: NodeEntityType[] = [];
			batches.forEach((batch) => {
				batch?.tasks.forEach((task) => {
					if (
						task.finishedAt &&
						task.status === "COMPLETED" &&
						task.node &&
						task.node.template.isTerminalNode
					) {
						const existing = state.entities[task.node.id];
						// If the node exists locally, check if result actually changed (ignoring selectedOutputIndex)
						// This prevents overwriting user's local selection when polling returns the same generation result
						if (existing && existing.result && task.node.result) {
							const { selectedOutputIndex: _e, ...existingRest } =
								existing.result as unknown as NodeResult;
							const { selectedOutputIndex: _n, ...newRest } = task.node
								.result as unknown as NodeResult;

							if (!isEqual(existingRest, newRest)) {
								completedNodes.push(task.node);
							}
						} else if (
							!existing ||
							!isEqual(existing.result, task.node.result)
						) {
							// Fallback for when node doesn't exist or result is null/undefined
							completedNodes.push(task.node);
						}
					}
				});
			});
			nodeAdapter.upsertMany(state, completedNodes);
		});
	},
});

export type NodesState = ReturnType<typeof nodesSlice.reducer>;

const nodeSelectors = nodeAdapter.getSelectors<RootState>(
	(state) => state.nodes,
);

export const selectNodeById = nodeSelectors.selectById;

export const makeSelectNodeById = (id: string) => {
	return (state: RootState) => nodeSelectors.selectById(state, id);
};

export const makeSelectAllNodes = nodeSelectors.selectAll;
export const makeSelectAllNodeEntities = nodeSelectors.selectEntities;

export const selectSelectedNodes = createDraftSafeSelector(
	(state: RootState) => selectSelectedNodeIds(state),
	(state: RootState) => nodeSelectors.selectAll(state),
	(nodeIds, nodes) =>
		nodeIds ? nodes.filter((f) => nodeIds.includes(f.id)) : undefined,
);

const { actions: nodeActions, reducer: nodesReducer } = nodesSlice;
export const {
	createNodeEntity,
	updateNodeEntity,
	updateNodeResult,
	updateNodeConfig,
	deleteManyNodeEntity,
	updateNodeConfigWithoutHistory,
	setAllNodeEntities,
} = nodeActions;
export { nodesReducer, nodeSelectors };
