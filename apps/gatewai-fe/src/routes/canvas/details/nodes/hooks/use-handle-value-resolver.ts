import { useAppSelector } from "@/store";
import { type HandleEntityType } from "@/store/handles";
import { selectConnectedNodeByHandleId } from "@/store/selectors";
import { useClientCacheNodeResultById, useClientCacheNodeResults, type ClientNodeResult } from "../../media-db";
import type { NodeResult, OutputItem } from "@gatewai/types";
import { makeSelectNodesByIds, type NodeEntityType } from "@/store/nodes";
import { makeSelectEdgesByTargetNodeId } from "@/store/edges";
import type { DataType } from "@gatewai/db";

/**
 * Returns result for the node that connected to source handle
 * @param handleId Source handle id
 * @returns NodeResult
 */
function useHandleValueResolver({handleId}:{handleId: HandleEntityType["id"]}) {
      const connectedNodeData = useAppSelector(selectConnectedNodeByHandleId(handleId ?? "0"))
      const cachedResult = useClientCacheNodeResultById(connectedNodeData?.node?.id ?? "0");
      const nodeResult = connectedNodeData?.node?.result as unknown as NodeResult;
      const nodeResultOutput = nodeResult?.outputs[nodeResult.selectedOutputIndex]
      const nodeResultHasItems = nodeResultOutput?.items?.length > 0;
      if (nodeResultHasItems) {
            return (connectedNodeData?.node?.result ?? cachedResult?.result) as NodeResult;
      }
      return (cachedResult?.result ?? connectedNodeData?.node?.result) as NodeResult;
}
export type NodeInputContextData = {
            node: NodeEntityType | null,
            result: NodeResult | null,
            resultValue: OutputItem<DataType> | undefined,
            cachedResult: ClientNodeResult | undefined,
            cachedResultValue: OutputItem<DataType> | undefined,
      };
export type NodeInputContext = Record<
      HandleEntityType["id"],
      NodeInputContextData
>;

/**
 * Returns values of connected nodes (as inputs)
 */
function useNodeInputValuesResolver({nodeId}: {nodeId: NodeEntityType["id"]}) {
      const edges = useAppSelector(makeSelectEdgesByTargetNodeId(nodeId))
      const sourceNodeIds = edges.map(m => m.source);
      const sourceNodes = useAppSelector(makeSelectNodesByIds(sourceNodeIds));
      const cachedResults = useClientCacheNodeResults(sourceNodeIds);
      const resultData: NodeInputContext = {}

      for (let i = 0; i < sourceNodes.length; i++) {
            const node = sourceNodes[i];
            const cachedResult = cachedResults?.find(f => f.id === node.id);
            const edge = edges.find(f => f.source === node.id && f.target === nodeId);
            const handleId = edge?.targetHandleId;
            const nodeResult = node.result as unknown as NodeResult;
            const currGen = nodeResult.outputs[nodeResult.selectedOutputIndex];

            const cachedResultGen = cachedResult?.result.outputs[cachedResult?.result.selectedOutputIndex];

            if (handleId) {
                  const resultValue = currGen.items.find(f => f.outputHandleId === edge.sourceHandleId);
                  const cachedResultValue = cachedResultGen?.items.find(f => f.outputHandleId === edge.sourceHandleId);
                  resultData[handleId] = {
                        resultValue,
                        result: nodeResult,
                        node,
                        cachedResult,
                        cachedResultValue,
                  };
            }
      }

      return resultData;
}

export { useHandleValueResolver, useNodeInputValuesResolver }
