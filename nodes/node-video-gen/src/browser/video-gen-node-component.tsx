import {
	AddCustomHandleButton,
	BaseNode,
	MediaDimensions,
	OutputSelector,
	RunNodeButton,
	useMediaInputSrc,
	useNodeResult,
	VideoRenderer,
} from "@gatewai/react-canvas";
import {
	makeSelectHandlesByNodeId,
	makeSelectNodeById,
	useAppSelector,
} from "@gatewai/react-store";
import { Popover, PopoverContent, PopoverTrigger } from "@gatewai/ui-kit";
import { memo } from "react";

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
					<div className="media-container -mx-0.5 mt-[-2px] min-h-[156px] relative border-b border-white/10 overflow-hidden">
						{hasMoreThanOneOutput && (
							<div className="absolute top-1 left-1 z-10">
								<OutputSelector node={node} />
							</div>
						)}
						{videoSrc && <VideoRenderer src={videoSrc} className="rounded-none w-full h-full" />}
						{node && (
							<div className="absolute bottom-1 left-1 z-10">
								<MediaDimensions node={node} />
							</div>
						)}
					</div>

					<div className="flex justify-between items-center w-full px-2">
						{/* Popover Logic for the Warning */}
						<Popover>
							<PopoverTrigger asChild>
								<div>
									<AddCustomHandleButton
										disabled={hasThreeImageInputs}
										nodeId={props.id}
										type="Input"
										label="Reference Image"
										dataTypes={node?.template.variableInputDataTypes}
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
