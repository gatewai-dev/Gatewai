import type { VirtualVideoData } from "@gatewai/core/types";
import {
	BaseNode,
	RunNodeButton,
	useNodeResult,
	VideoRenderer,
} from "@gatewai/react-canvas";
import { resolveVideoSourceUrl } from "@gatewai/remotion-compositions";
import { memo } from "react";

const VideoCropNodeComponent = memo(
	(props: { selected: boolean; id: string; dragging: boolean }) => {
		const { result } = useNodeResult(props.id);

		const virtualVideo = result?.outputs?.[result.selectedOutputIndex ?? 0]
			?.items?.[0]?.data as VirtualVideoData | undefined;

		const videoSrc = virtualVideo
			? resolveVideoSourceUrl(virtualVideo)
			: undefined;
		console.log({ videoSrc, result });
		return (
			<BaseNode
				selected={props.selected}
				id={props.id}
				dragging={props.dragging}
			>
				<div className="flex flex-col gap-3">
					<div className="media-container -mx-0.5 mt-[-2px] relative min-h-[156px] border-b border-white/10">
						{videoSrc && <VideoRenderer src={videoSrc} className="rounded-none w-full h-full" />}
					</div>
					<div className="flex justify-end items-center w-full px-2">
						<RunNodeButton nodeId={props.id} />
					</div>
				</div>
			</BaseNode>
		);
	},
);

export { VideoCropNodeComponent };
