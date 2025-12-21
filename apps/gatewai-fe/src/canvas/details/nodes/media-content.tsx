import { Button } from "@/components/ui/button";
import type { ImagesResult } from "@gatewai/types";
import type { NodeProps } from "@xyflow/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { GPTImage1Node } from "./node-props";
import { useCanvasCtx } from "../ctx/canvas-ctx";

function MediaContent({node, result}: {node: NodeProps<GPTImage1Node>, result: ImagesResult}) {
    const parts = result.parts;
    const selectedPart = result.parts[result.selectedIndex];
    const { updateNodeCustomData } = useCanvasCtx();
    console.log({node})
    const incrementSelectedIndex = () => {
        const newIndex = result.selectedIndex + 1;
        const clampedIndex = Math.max(0, Math.min(newIndex, parts.length - 1));
        console.log({newIndex, clampedIndex, partsLength: parts.length});
        updateNodeCustomData(node.id, { result: { ...result, selectedIndex: clampedIndex } });
    };

    const decrementSelectedIndex = () => {
        const newIndex = result.selectedIndex - 1;
        const clampedIndex = Math.max(0, Math.min(newIndex, parts.length - 1));
        updateNodeCustomData(node.id, { result: { ...result, selectedIndex: clampedIndex } });
    }

    if (parts.length === 0) {
        return <div className="h-full w-full media-container"></div>;
    }


    return (
        <div className='relative h-full w-full group'>
            <div className="absolute w-full h-full">
                <div className='absolute  bg-background/20 top-1 left-1 text-white text-[8px] flex items-center gap-1'>
                    <Button
                        size="xs"
                        onClick={() => decrementSelectedIndex()}
                        variant="ghost">
                        <ChevronLeft />
                    </Button>
                    <span>{result.selectedIndex + 1} / {parts.length}</span>
                    <Button
                        size="xs"
                        onClick={() => incrementSelectedIndex()}
                        variant="ghost">
                        <ChevronRight />
                    </Button>
                </div>
            </div>
            <img src={selectedPart.data.url} alt={selectedPart.data.name} className='w-full h-full' />
        </div>
    );
}

export { MediaContent };