import { memo } from "react";
import { useAppSelector } from "@/store";
import { makeSelectNodeById } from "@/store/nodes";
import { RunNodeButton } from "../../components/run-node-button";
import { OutputSelector } from "../../misc/output-selector";
import { useNodeResult } from "../../processor/processor-ctx";
import { BaseNode } from "../base";
import { AudioRenderer } from "../common/audio-renderer";
import { useMediaInputSrc } from "../common/hooks/use-media-src";

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
						{audioSrc && <AudioRenderer showControlsAlways src={audioSrc} />}
					</div>
					{!audioSrc && (
						<div className="min-h-[50px] w-full bg-input max-h-full p-2">
							<p className="text-xs text-gray-500">
								Audio track will display here after generation
							</p>
						</div>
					)}

					<div className="flex justify-end items-center w-full">
						<RunNodeButton nodeId={props.id} />
					</div>
				</div>
			</BaseNode>
		);
	},
);

export { TextToSpeechNodeComponent };
