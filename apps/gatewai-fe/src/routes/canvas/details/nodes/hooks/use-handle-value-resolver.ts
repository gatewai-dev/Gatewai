import { useAppSelector } from "@/store";
import type { HandleEntityType } from "@/store/handles";
import { selectNodeByHandleId } from "@/store/selectors";
import { useClientCacheNodeResultById } from "../../media-db";
import type { NodeResult } from "@gatewai/types";

function useHandleValueResolver({handleId}:{handleId: HandleEntityType["id"]}) {

      const node = useAppSelector(selectNodeByHandleId(handleId ?? "0"))

      const cachedResult = useClientCacheNodeResultById(node?.id ?? "0");
      const result = (node?.result ?? cachedResult?.result) as NodeResult;

      if (!result) return null;

      const generation =  result.outputs[result.selectedOutputIndex];

      return generation.items.find(f => f.outputHandleId === handleId);
}

export { useHandleValueResolver }
