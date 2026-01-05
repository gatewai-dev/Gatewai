import { memo } from "react";
import { useAppSelector } from "@/store";
import { makeSelectNodeById } from "@/store/nodes";
import { RunNodeButton } from "../../components/run-node-button";
import { useNodeResult } from "../../processor/processor-ctx";
import { BaseNode } from "../base";
import { useMediaInputSrc } from "../common/hooks/use-media-src";
import { VideoRenderer } from "../common/video-renderer";
import { OutputSelector } from "../misc/output-selector";

const VideoGenFirstLastFrameNodeComponent = memo(
	(props: { selected: boolean; id: string; dragging: boolean }) => {
		const node = useAppSelector(makeSelectNodeById(props.id));

		const { result } = useNodeResult(props.id);
		const hasMoreThanOneOutput = result?.outputs && result?.outputs?.length > 1;

		const videoSrc = useMediaInputSrc(props.id, "Video");

		return (
			<BaseNode
				selected={props.selected}
				id={props.id}
				dragging={props.dragging}
			>
				<div className="flex flex-col gap-3">
					<div className="media-container w-full rounded-xs min-h-[156px] relative">
						{hasMoreThanOneOutput && (
							<div className="absolute top-1 left-1 z-10">
								<OutputSelector node={node} />
							</div>
						)}
						{videoSrc && <VideoRenderer src={videoSrc} />}
					</div>

					<div className="flex justify-between items-center w-full">
						<RunNodeButton nodeId={props.id} />
					</div>
				</div>
			</BaseNode>
		);
	},
);

export { VideoGenFirstLastFrameNodeComponent };
