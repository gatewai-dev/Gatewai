import { useAppSelector } from "@/store";
import type { HandleEntityType } from "@/store/handles";
import { selectConnectedNodeByHandleId } from "@/store/selectors";
import { useClientCacheNodeResultById } from "../../media-db";
import type { NodeResult } from "@gatewai/types";

/**
 * Returns result for the node that connected to source handle
 * @param handleId Source handle id
 * @returns NodeResult
 */
function useHandleValueResolver({handleId, nodeId}:{handleId: HandleEntityType["id"], nodeId?: string}) {
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

export { useHandleValueResolver }
