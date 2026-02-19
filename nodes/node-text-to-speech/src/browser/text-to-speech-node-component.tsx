import {
	AudioRenderer,
	BaseNode,
	OutputSelector,
	RunNodeButton,
	useMediaInputSrc,
	useNodeResult,
} from "@gatewai/react-canvas";
import { makeSelectNodeById, useAppSelector } from "@gatewai/react-store";
import { memo } from "react";

const TextToSpeechNodeComponent = memo(
	(props: { selected: boolean; id: string; dragging: boolean }) => {
		const node = useAppSelector(makeSelectNodeById(props.id));
		const { result } = useNodeResult(props.id);
		const hasMoreThanOneOutput = result?.outputs && result?.outputs?.length > 1;
		const audioSrc = useMediaInputSrc(props.id, "Audio");

		return (
			<BaseNode
				selected={props.selected}
				id={props.id}
				dragging={props.dragging}
			>
				<div className="flex flex-col gap-3">
					<div className="w-full rounded-xs relative">
						{hasMoreThanOneOutput && (
							<div className="absolute top-1 left-1 z-10">
								<OutputSelector node={node} />
							</div>
						)}
						{audioSrc && <AudioRenderer src={audioSrc} />}
					</div>
					{!audioSrc && (
						<div className="min-h-[50px] w-full bg-input max-h-full p-2 flex items-center justify-center">
							<p className="text-xs text-gray-500">Audio will appear here.</p>
						</div>
					)}

					<div className="flex justify-end items-center w-full p-1.5">
						<RunNodeButton nodeId={props.id} />
					</div>
				</div>
			</BaseNode>
		);
	},
);

export { TextToSpeechNodeComponent };
