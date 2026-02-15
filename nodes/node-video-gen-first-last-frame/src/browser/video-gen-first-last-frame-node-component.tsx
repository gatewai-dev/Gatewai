import {
    MediaDimensions,
    OutputSelector,
    RunNodeButton,
} from "@gatewai/node-sdk/client";
import {
    BaseNode,
    useNodePreview,
    VideoRenderer,
} from "@gatewai/react-canvas";
import { memo } from "react";

const VideoGenFirstLastFrameNodeComponent = memo(
    (props: { selected: boolean; id: string; dragging: boolean }) => {
        const { videoUrl, node, hasMoreThanOneOutput } = useNodePreview(props.id);

        return (
            <BaseNode
                selected={props.selected}
                id={props.id}
                dragging={props.dragging}
            >
                <div className="flex flex-col gap-3">
                    <div className="media-container w-full overflow-hidden rounded relative min-h-32">
                        {hasMoreThanOneOutput && (
                            <div className="absolute top-1 left-1 z-10">
                                <OutputSelector node={node} />
                            </div>
                        )}
                        {videoUrl && <VideoRenderer src={videoUrl} />}
                        <div className="absolute bottom-1 left-1 z-10">
                            <MediaDimensions node={node} />
                        </div>
                    </div>

                    <div className="flex justify-end items-center w-full">
                        <RunNodeButton nodeId={props.id} />
                    </div>
                </div>
            </BaseNode>
        );
    },
);

VideoGenFirstLastFrameNodeComponent.displayName = "VideoGenFirstLastFrameNode";

export { VideoGenFirstLastFrameNodeComponent };
