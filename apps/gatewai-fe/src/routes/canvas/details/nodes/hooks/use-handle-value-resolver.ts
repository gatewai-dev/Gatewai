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
function useHandleValueResolver({handleId}:{handleId: HandleEntityType["id"]}) {
      const connectedNodeData = useAppSelector(selectConnectedNodeByHandleId(handleId ?? "0"))
      const cachedResult = useClientCacheNodeResultById(connectedNodeData?.node?.id ?? "0");
      const result = (cachedResult?.result ?? connectedNodeData?.node?.result) as NodeResult;
      return result;
}

export { useHandleValueResolver }
