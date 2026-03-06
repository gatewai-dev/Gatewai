import type { NodeResult } from "@gatewai/core/types";
import { createSelector } from "@reduxjs/toolkit";
import { edgeSelectors } from "./edges.js";
import { type HandleEntityType, handleSelectors } from "./handles.js";
import { nodeSelectors } from "./nodes.js";

export const selectConnectedNodeByHandleId = (
	handleId: HandleEntityType["id"],
) =>
	createSelector(
		nodeSelectors.selectAll,
		edgeSelectors.selectAll,
		handleSelectors.selectEntities,
		(nodes, edges, handles) => {
			const edge = edges.find((f) => f.targetHandleId === handleId);
			const sourceHandleId = edge?.sourceHandleId;
			if (!sourceHandleId) {
				return null;
			}
			const sourceHandle = handles[sourceHandleId];
			const node = nodes.find((f) => f.id === sourceHandle?.nodeId);
			if (!node) return null;
			return { node, sourceHandle };
		},
	);

export const selectNodeResultByHandleId = (
	handleId: HandleEntityType["id"],
): ((state: any) => any) =>
	createSelector(
		selectConnectedNodeByHandleId(handleId),
		edgeSelectors.selectAll,
		(connectedNodeInfo, edges) => {
			const edge = edges.find((f) => f.targetHandleId === handleId);
			if (!connectedNodeInfo) return null;
			const output = connectedNodeInfo.node?.result as unknown as NodeResult;
			if (!output) return null;
			const activeGeneration = output.outputs[output.selectedOutputIndex];
			if (!activeGeneration?.items) return null;

			const outputItem = activeGeneration.items.find(
				(f) => f.outputHandleId === edge?.sourceHandleId,
			);

			return outputItem;
		},
	);
