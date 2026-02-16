import { useNodeUI } from "@gatewai/node-sdk/browser";
import {
    AddCustomHandleButton,
    MediaDimensions,
    OutputSelector,
    RunNodeButton,
} from "@gatewai/node-sdk/browser";
import { CanvasRenderer } from "@gatewai/react-canvas";
import { useNodePreview } from "@gatewai/node-sdk/browser";
import { memo } from "react";

const ImageGenNodeComponent = memo(
    (props: { selected: boolean; id: string; dragging: boolean }) => {
        const { BaseNode } = useNodeUI();
        const { imageUrl, node, hasMoreThanOneOutput } = useNodePreview(props.id);

        return (
            <BaseNode
                selected={props.selected}
                id={props.id}
                dragging={props.dragging}
            >
                <div className="flex flex-col gap-3">
                    <div className="media-container w-full overflow-hidden rounded min-h-32 relative">
                        {hasMoreThanOneOutput && node && (
                            <div className="absolute top-1 left-1 z-10">
                                <OutputSelector node={node} />
                            </div>
                        )}
                        {imageUrl && <CanvasRenderer imageUrl={imageUrl} />}
                        <div className="absolute bottom-1 left-1 z-10">
                            <MediaDimensions node={node} />
                        </div>
                    </div>

                    <div className="flex justify-between items-center w-full">
                        <AddCustomHandleButton
                            nodeId={props.id}
                            type="Input"
                            label="Add Reference Image"
                            dataTypes={node?.template.variableInputDataTypes}
                        />
                        <RunNodeButton nodeId={props.id} />
                    </div>
                </div>
            </BaseNode>
        );
    },
);

export { ImageGenNodeComponent };
