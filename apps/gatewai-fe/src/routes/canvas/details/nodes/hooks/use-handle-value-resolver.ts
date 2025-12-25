import { useAppSelector } from "@/store";
import { type HandleEntityType } from "@/store/handles";
import { selectConnectedNodeByHandleId } from "@/store/selectors";
import { useClientCacheNodeResultById, useClientCacheNodeResults, type ClientNodeResult } from "../../media-db";
import type { NodeResult } from "@gatewai/types";
import { makeSelectNodesByIds, type NodeEntityType } from "@/store/nodes";
import { makeSelectEdgesByTargetNodeId } from "@/store/edges";

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

function useNodeInputValuesResolver({nodeId}: {nodeId: NodeEntityType["id"]}) {
      const edges = useAppSelector(makeSelectEdgesByTargetNodeId(nodeId))
      const sourceNodeIds = edges.map(m => m.source);
      const sourceNodes = useAppSelector(makeSelectNodesByIds(sourceNodeIds));
      const cachedResults = useClientCacheNodeResults(sourceNodeIds);
      const resultData: Record<NodeEntityType["id"], { nodeResult: NodeResult | null, cachedResult: ClientNodeResult | undefined }> = {}

      for (let i = 0; i < sourceNodes.length; i++) {
            const node = sourceNodes[i];
            resultData[node.id] = {
                  nodeResult: node.result as unknown as NodeResult,
                  cachedResult: cachedResults?.find(f => f.id === node.id)
            };
      }
}

export { useHandleValueResolver, useNodeInputValuesResolver }
