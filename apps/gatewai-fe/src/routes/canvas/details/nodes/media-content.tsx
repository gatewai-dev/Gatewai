import type { FileResult, ImagesResult } from "@gatewai/types";
import type { NodeProps } from "@xyflow/react";
import type { AnyNode } from "./node-props";
import { OutputSelector } from "./misc/output-selector";
import { FileIcon } from "lucide-react";
import { MediaController } from 'media-chrome/react';

function MediaContent({node, result}: {node: NodeProps<AnyNode>, result: ImagesResult | FileResult}) {
    const selectedOutput = result.outputs[result.selectedOutputIndex];
    const outputItem = selectedOutput.items[0]
    const isImage = outputItem.data.entity.mimeType.startsWith('image');
    const isVideo = outputItem.data.entity.mimeType.startsWith('video');
    const isOther = !isVideo && !isImage;
    if (!outputItem.data.entity.signedUrl) {
        return null;
    }

    return (
        <div className='relative h-full w-full group'>
            <div className="absolute w-full h-full">
                <OutputSelector node={node} />
            </div>
            {isImage && (<img
                src={outputItem.data.entity.signedUrl}
                alt={outputItem.data.entity.name}
                className='w-full h-full' />
            )}
            {isVideo && <div className="flex flex-col items-center gap-2">
                <MediaController>
                    <video
                        slot="media"
                        src={outputItem.data.entity.signedUrl}
                        preload="auto"
                    />
                </MediaController>
            </div>}
            {isOther && <div className="flex flex-col items-center gap-2">
                <FileIcon className="w-5 h-5" /> <span>{outputItem.data.entity.name}</span>
            </div>}
        </div>
    );
}

export { MediaContent };