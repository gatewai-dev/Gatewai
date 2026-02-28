import {
	AddCustomHandleButton,
	BaseNode,
	MediaContent,
	MediaDimensions,
	OutputSelector,
	RunNodeButton,
	useNodePreview,
} from "@gatewai/react-canvas";
import { memo } from "react";

const LottieNodeComponent = memo(
	(props: { selected: boolean; id: string; dragging: boolean }) => {
		const { mediaUrl, node, hasMoreThanOneOutput } = useNodePreview(props.id);

		return (
			<BaseNode
				selected={props.selected}
				id={props.id}
				dragging={props.dragging}
			>
				<div className="flex flex-col gap-3 min-w-[200px]">
					<div className="media-container w-full overflow-hidden rounded bg-white/10 min-h-[150px] relative flex items-center justify-center">
						{hasMoreThanOneOutput && node && (
							<div className="absolute top-1 left-1 z-10">
								<OutputSelector node={node} />
							</div>
						)}
						{mediaUrl ? (
							<MediaContent node={node} />
						) : (
							<div className="text-xs w-full text-muted-foreground italic text-center p-4 border rounded-md border-dashed">
								No Lottie generated yet
							</div>
						)}
						{node && mediaUrl && (
							<div className="absolute bottom-1 left-1 z-10">
								<MediaDimensions node={node} />
							</div>
						)}
					</div>

					<div className="flex justify-between items-center w-full p-1.5">
						<AddCustomHandleButton
							nodeId={props.id}
							type="Input"
							label="Add Reference Lottie"
							dataTypes={node?.template.variableInputDataTypes}
						/>
						<RunNodeButton nodeId={props.id} />
					</div>
				</div>
			</BaseNode>
		);
	},
);

export { LottieNodeComponent };
