import { memo } from "react";
import { useAppSelector } from "@/store";
import { makeSelectHandlesByNodeId } from "@/store/handles";
import { makeSelectNodeById } from "@/store/nodes";
import { RunNodeButton } from "../../components/run-node-button";
import { useNodeResult } from "../../processor/processor-ctx";
import { BaseNode } from "../base";
import { CreateHandleButton } from "../common/create-handle-button";
import { useVideoSrc } from "../common/hooks/use-video-src";
import { VideoRenderer } from "../common/video-renderer";
import { OutputSelector } from "../misc/output-selector";

const VideoGenNodeComponent = memo(
	(props: { selected: boolean; id: string; dragging: boolean }) => {
		const node = useAppSelector(makeSelectNodeById(props.id));
		const { result } = useNodeResult(props.id);
		const selectHandles = useAppSelector(makeSelectHandlesByNodeId(props.id));
		const inputHandles = selectHandles.filter((f) => f.type === "Input");
		const referenceInputHandles = inputHandles.filter((f) =>
			f.dataTypes.includes("Image"),
		);

		const hasThreeImageInputs = referenceInputHandles.length === 3;
		const hasMoreThanOneOutput = result?.outputs && result?.outputs?.length > 1;

		const videoSrc = useVideoSrc(props.id);

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
						<CreateHandleButton
							title={
								hasThreeImageInputs
									? "Three is the max number of reference images that can be used."
									: undefined
							}
							disabled={hasThreeImageInputs}
							nodeId={props.id}
						/>
						<RunNodeButton nodeId={props.id} />
					</div>
				</div>
			</BaseNode>
		);
	},
);

export { VideoGenNodeComponent };
