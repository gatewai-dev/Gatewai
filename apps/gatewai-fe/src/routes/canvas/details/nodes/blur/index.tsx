import type { NodeProps } from "@gatewai/react-canvas";
import {
	BaseNode,
	CanvasRenderer,
	useNodePreview,
} from "@gatewai/react-canvas";
import { memo } from "react";
import type { BlurNode } from "../node-props";
import { BlurValueSlider } from "./blur-slider";

const BlurNodeComponent = memo((props: NodeProps<BlurNode>) => {
	const { imageUrl, node } = useNodePreview(props.id);

	return (
		<BaseNode selected={props.selected} id={props.id} dragging={props.dragging}>
			<div className="flex flex-col gap-3">
				<div className="w-full overflow-hidden min-h-32 rounded media-container relative">
					{imageUrl && <CanvasRenderer imageUrl={imageUrl} />}
				</div>
				{node && (
					<div className="flex gap-3 items-end p-1">
						<BlurValueSlider node={node} />
					</div>
				)}
			</div>
		</BaseNode>
	);
});

BlurNodeComponent.displayName = "BlurNodeComponent";

export { BlurNodeComponent };
