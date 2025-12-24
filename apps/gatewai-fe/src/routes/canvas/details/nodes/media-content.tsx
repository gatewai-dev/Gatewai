import { Button } from "@/components/ui/button";
import type { ImagesResult } from "@gatewai/types";
import type { NodeProps } from "@xyflow/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { AnyNode } from "./node-props";
import { useAppDispatch } from "@/store";
import { incrementSelectedResultIndex, decrementSelectedResultIndex } from "@/store/nodes";

function MediaContent({node, result}: {node: NodeProps<AnyNode>, result: ImagesResult}) {
    const dispatch = useAppDispatch();

    const selectedOutput = result.outputs[result.selectedOutputIndex];

    const imagePart = selectedOutput.items[0]

    const incrementSelectedIndex = () => {
        dispatch(incrementSelectedResultIndex({ id: node.id }));
    };

    const decrementSelectedIndex = () => {
        dispatch(decrementSelectedResultIndex({ id: node.id }));
    }

    return (
        <div className='relative h-full w-full group'>
            <div className="absolute w-full h-full">
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
            </div>
            <img src={imagePart.data.url} alt={imagePart.data.name} className='w-full h-full' />
        </div>
    );
}

export { MediaContent };