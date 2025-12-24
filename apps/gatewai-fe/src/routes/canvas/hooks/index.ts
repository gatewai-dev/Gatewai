import type { NodeProps } from "@xyflow/react";
import { useMemo } from "react";
import type { AnyNode } from "../details/nodes/node-props";

const useHasOutputItems = (nodeProps: NodeProps<AnyNode>) => useMemo(() => {
    const outputs = nodeProps.data?.result?.outputs;
    const hasOutputs = outputs && outputs.length ;
    if (hasOutputs) {
        const hasItems = outputs[0].items && outputs[0].items.length > 0;
        return hasItems;
    }
    return false;
}, [nodeProps.data?.result?.outputs])

export { useHasOutputItems }
