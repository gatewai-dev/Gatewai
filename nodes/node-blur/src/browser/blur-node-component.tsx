import {
	BaseNode,
	CanvasRenderer,
	type NodeProps,
	useNodePreview,
} from "@gatewai/react-canvas";
import { cn } from "@gatewai/ui-kit";
import { memo } from "react";
import { BlurValueSlider } from "./components/blur-slider.js";

const BlurNodeComponent = memo((props: NodeProps) => {
	const { mediaUrl, node } = useNodePreview(props.id);

	return (
		<BaseNode selected={props.selected} id={props.id} dragging={props.dragging}>
			<div className="flex flex-col">
				<div
					className={cn("w-full overflow-hidden rounded media-container", {
						"min-h-32": !mediaUrl,
						"h-full": mediaUrl,
					})}
				>
					{mediaUrl && <CanvasRenderer imageUrl={mediaUrl} />}
				</div>
				{node && (
					<div className="flex gap-3 items-end p-2">
						<BlurValueSlider node={node} />
					</div>
				)}
			</div>
		</BaseNode>
	);
});

export { BlurNodeComponent };
