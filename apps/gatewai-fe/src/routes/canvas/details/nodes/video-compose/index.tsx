import type { FileData } from "@gatewai/types";
import type { NodeProps } from "@xyflow/react";
import { VideoIcon } from "lucide-react";
import { memo, useMemo } from "react";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAppSelector } from "@/store";
import { makeSelectNodeById } from "@/store/nodes";
import { AddCustomHandleButton } from "../../components/add-custom-handle";
import { useNodeResult } from "../../processor/processor-ctx";
import { BaseNode } from "../base";
import { VideoRenderer } from "../common/video-renderer";
import type { CompositorNode } from "../node-props";

const VideoCompositorNodeComponent = memo(
	(props: NodeProps<CompositorNode>) => {
		const node = useAppSelector(makeSelectNodeById(props.id));
		const { result, isProcessing } = useNodeResult(props.id);
		const nav = useNavigate();

		const videoSrc = useMemo(() => {
			const output = result?.outputs[result.selectedOutputIndex];
			const outputItem = output?.items[0].data as FileData;
			return outputItem?.processData?.dataUrl;
		}, [result]);

		return (
			<BaseNode
				selected={props.selected}
				id={props.id}
				dragging={props.dragging}
			>
				<div className="flex flex-col gap-3 ">
					<div
						className={cn(
							"w-full overflow-hidden rounded media-container relative",
							{
								"h-48": !videoSrc,
							},
						)}
					>
						{isProcessing && (
							<div className="inset-0 z-10 absolute text-foreground bg-background/20 w-full h-full flex items-center justify-center">
								Rendering Video...
							</div>
						)}
						{videoSrc && <VideoRenderer src={videoSrc} />}
					</div>
					<div className="flex justify-between items-center">
						<AddCustomHandleButton
							dataTypes={["Video", "Audio", "Image", "Text"]}
							nodeProps={props}
							type="Input"
						/>
						{node && (
							<Button onClick={() => nav(`video-editor/${node.id}`)} size="sm">
								<VideoIcon /> Edit
							</Button>
						)}
					</div>
				</div>
			</BaseNode>
		);
	},
);

VideoCompositorNodeComponent.displayName = "VideoCompositorNodeComponent";

export { VideoCompositorNodeComponent };
