import { memo } from "react";
// Assuming you have a Popover component in your UI library
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { useAppSelector } from "@/store";
import { makeSelectHandlesByNodeId } from "@/store/handles";
import { makeSelectNodeById } from "@/store/nodes";
import { AddCustomHandleButton } from "../../components/add-custom-handle";
import { RunNodeButton } from "../../components/run-node-button";
import { useNodeResult } from "../../graph-engine/processor-ctx";
import { MediaDimensions } from "../../misc/media-dimensions";
import { OutputSelector } from "../../misc/output-selector";
import { BaseNode } from "../base";
import { useMediaInputSrc } from "../common/hooks/use-media-src";
import { VideoRenderer } from "../common/video-renderer";

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
						<div className="absolute bottom-1 left-1 z-10">
							<MediaDimensions node={node} />
						</div>
					</div>

					<div className="flex justify-between items-center w-full">
						{/* Popover Logic for the Warning */}
						<Popover>
							<PopoverTrigger asChild>
								<div>
									{" "}
									{/* Wrapper to allow trigger on disabled buttons if needed */}
									<AddCustomHandleButton
										disabled={hasThreeImageInputs}
										nodeId={props.id}
										type="Input"
										dataTypes={["Image"]}
									/>
								</div>
							</PopoverTrigger>
							{hasThreeImageInputs && (
								<PopoverContent
									side="top"
									className="text-xs p-2 max-w-[200px]"
								>
									Three is the max number of reference images that can be used.
								</PopoverContent>
							)}
						</Popover>

						<RunNodeButton nodeId={props.id} />
					</div>
				</div>
			</BaseNode>
		);
	},
);

export { VideoGenNodeComponent };
