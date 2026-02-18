import {
	BaseNode,
	CanvasRenderer,
	type NodeProps,
	useNodePreview,
} from "@gatewai/react-canvas";
import { memo } from "react";
import { BlurValueSlider } from "./components/blur-slider.js";

const BlurNodeComponent = memo((props: NodeProps) => {
	const { imageUrl, node } = useNodePreview(props.id);

	return (
		<BaseNode selected={props.selected} id={props.id} dragging={props.dragging}>
			<div className="flex flex-col">
				<div className="w-full overflow-hidden min-h-32 rounded media-container relative">
					{imageUrl && <CanvasRenderer imageUrl={imageUrl} />}
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
