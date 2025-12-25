import { createSelector } from "@reduxjs/toolkit";
import { handleSelectors, type HandleEntityType } from "./handles";
import { nodeSelectors } from "./nodes";
import { edgeSelectors } from "./edges";
import type { NodeResult } from "@gatewai/types";

export const selectNodeByHandleId = (handleId: HandleEntityType["id"]) => createSelector(
    nodeSelectors.selectAll,
    edgeSelectors.selectAll,
    handleSelectors.selectEntities,
    (nodes, edges, handles) => {
        const edge = edges.find(f => f.targetHandleId === handleId);
        const sourceHandleId = edge?.sourceHandleId;
        if (!sourceHandleId) {
            return null;
        }
        const sourceHandle = handles[sourceHandleId];
        const node = nodes.find(f => f.id === sourceHandle.nodeId);
        return node;
    }
)

export const selectNodeResultByHandleId = (handleId: HandleEntityType["id"]) => createSelector(
    selectNodeByHandleId(handleId),
    edgeSelectors.selectAll,
    (node, edges) => {
        const edge = edges.find(f => f.targetHandleId === handleId);
        if (!node) return;
        const output = node.result as unknown as NodeResult;

        const activeGeneration = output.outputs[output.selectedOutputIndex];
        if (!activeGeneration?.items) return null;

        const outputItem = activeGeneration.items.find(f => f.outputHandleId === edge?.sourceHandleId);

        return outputItem;
    }
)