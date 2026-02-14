import { useNodePreview, useNodeUI } from "@gatewai/node-sdk/browser";
import { memo } from "react";
import { BlurValueSlider } from "./components/blur-slider.js";

const BlurNodeComponent = memo((props: any) => {
	const { BaseNode, CanvasRenderer } = useNodeUI();
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

export { BlurNodeComponent };
