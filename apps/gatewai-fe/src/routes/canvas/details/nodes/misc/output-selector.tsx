import { Button } from "@/components/ui/button";
import type { NodeResult } from "@gatewai/types";
import type { NodeProps } from "@xyflow/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/store";
import { incrementSelectedResultIndex, decrementSelectedResultIndex, makeSelectNodeById } from "@/store/nodes";
import type { AnyNode } from "../node-props";

function OutputSelector({node}: {node: NodeProps<AnyNode>}) {
    const dispatch = useAppDispatch();
    const nodeEntity = useAppSelector(makeSelectNodeById(node.id))
    const result = nodeEntity?.result as unknown as NodeResult
    if (!result || isNaN(result.selectedOutputIndex)) {
        return null;
    }
    const incrementSelectedIndex = () => {
        dispatch(incrementSelectedResultIndex({ id: node.id }));
    };

    const decrementSelectedIndex = () => {
        dispatch(decrementSelectedResultIndex({ id: node.id }));
    }

    return (
        <div className='absolute bg-background/20 top-1 left-1 text-white text-[8px] flex items-center gap-1'>
            <Button
                size="xs"
                onClick={() => decrementSelectedIndex()}
                variant="ghost">
                <ChevronLeft />
            </Button>
            <span>{result.selectedOutputIndex + 1} / {result.outputs.length}</span>
            <Button
                size="xs"
                onClick={() => incrementSelectedIndex()}
                variant="ghost">
                <ChevronRight />
            </Button>
        </div>
    );
}

export { OutputSelector };