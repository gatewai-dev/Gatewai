import type { ImagesResult } from "@gatewai/types";
import type { NodeProps } from "@xyflow/react";
import type { AnyNode } from "./node-props";
import { OutputSelector } from "./misc/output-selector";

function MediaContent({node, result}: {node: NodeProps<AnyNode>, result: ImagesResult}) {
    const selectedOutput = result.outputs[result.selectedOutputIndex];
    const imagePart = selectedOutput.items[0]
    if (!imagePart.data.entity.signedUrl) {
        return null;
    }

    return (
        <div className='relative h-full w-full group'>
            <div className="absolute w-full h-full">
                <OutputSelector node={node} />
            </div>
            <img src={imagePart.data.entity.signedUrl} alt={imagePart.data.entity.signedUrl} className='w-full h-full' />
        </div>
    );
}

export { MediaContent };