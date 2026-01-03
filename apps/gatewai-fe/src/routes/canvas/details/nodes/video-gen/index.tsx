import type { VideoGenResult } from "@gatewai/types";
import { memo, useMemo } from "react";
import { useAppSelector } from "@/store";
import { makeSelectNodeById } from "@/store/nodes";
import { GetAssetEndpoint } from "@/utils/file";
import { RunNodeButton } from "../../components/run-node-button";
import { useNodeResult } from "../../processor/processor-ctx";
import { BaseNode } from "../base";
import { CreateHandleButton } from "../common/create-handle-button";
import { VideoRenderer } from "../common/video-renderer";
import { OutputSelector } from "../misc/output-selector";

const VideoGenNodeComponent = memo(
	(props: { selected: boolean; id: string; dragging: boolean }) => {
		const node = useAppSelector(makeSelectNodeById(props.id));

		const { result } = useNodeResult(props.id);
		const hasMoreThanOneOutput = result?.outputs && result?.outputs?.length > 1;

		const videoOutputItem = useMemo(() => {
			const nodeResult = result as VideoGenResult;
			const outputItem = nodeResult?.outputs[nodeResult.selectedOutputIndex];
			if (outputItem) {
				return outputItem.items.find((f) => f.type === "Video")?.data;
			}
			return null;
		}, [result]);

		const videoSrc = videoOutputItem?.entity?.id
			? GetAssetEndpoint(videoOutputItem?.entity?.id)
			: null;
		return (
			<BaseNode
				selected={props.selected}
				id={props.id}
				dragging={props.dragging}
			>
				<div className="flex flex-col gap-3">
					<div className="media-container w-full overflow-hidden rounded  min-h-[100px] relative">
						{hasMoreThanOneOutput && (
							<div className="absolute top-1 left-1 z-10">
								<OutputSelector node={node} />
							</div>
						)}
						{videoSrc && <VideoRenderer src={videoSrc} />}
					</div>

					<div className="flex justify-between items-center w-full">
						<CreateHandleButton nodeId={props.id} />
						<RunNodeButton nodeId={props.id} />
					</div>
				</div>
			</BaseNode>
		);
	},
);

export { VideoGenNodeComponent };
