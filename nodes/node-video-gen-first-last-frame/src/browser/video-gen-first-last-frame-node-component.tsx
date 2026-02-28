import {
	BaseNode,
	MediaDimensions,
	OutputSelector,
	RunNodeButton,
	useNodePreview,
	VideoRenderer,
} from "@gatewai/react-canvas";
import { memo } from "react";

const VideoGenFirstLastFrameNodeComponent = memo(
	(props: { selected: boolean; id: string; dragging: boolean }) => {
		const { mediaUrl, node, hasMoreThanOneOutput } = useNodePreview(props.id);

		return (
			<BaseNode
				selected={props.selected}
				id={props.id}
				dragging={props.dragging}
			>
				<div className="flex flex-col gap-3">
					<div className="media-container -mx-0.5 mt-[-2px] overflow-hidden relative min-h-32 border-b border-white/10">
						{hasMoreThanOneOutput && node && (
							<div className="absolute top-1 left-1 z-10">
								<OutputSelector node={node} />
							</div>
						)}
						{mediaUrl && (
							<VideoRenderer
								src={mediaUrl}
								className="rounded-none w-full h-full"
							/>
						)}
						{node && (
							<div className="absolute bottom-1 left-1 z-10">
								<MediaDimensions node={node} />
							</div>
						)}
					</div>

					<div className="flex justify-end items-center w-full px-2">
						<RunNodeButton nodeId={props.id} />
					</div>
				</div>
			</BaseNode>
		);
	},
);

export { VideoGenFirstLastFrameNodeComponent };
