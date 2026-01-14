import { memo } from "react";
import { RunNodeButton } from "../../components/run-node-button";
import { useNodePreview } from "../../hooks/node-preview";
import { OutputSelector } from "../../misc/output-selector";
import { BaseNode } from "../base";
import { CanvasRenderer } from "../common/canvas-renderer";
import { CreateHandleButton } from "../common/create-handle-button";

const ImageGenNodeComponent = memo(
	(props: { selected: boolean; id: string; dragging: boolean }) => {
		const { imageUrl, node, hasMoreThanOneOutput } = useNodePreview(props.id);

		return (
			<BaseNode
				selected={props.selected}
				id={props.id}
				dragging={props.dragging}
			>
				<div className="flex flex-col gap-3">
					<div className="media-container w-full overflow-hidden rounded min-h-32 relative">
						{hasMoreThanOneOutput && node && (
							<div className="absolute top-1 left-1 z-10">
								<OutputSelector node={node} />
							</div>
						)}
						{imageUrl && <CanvasRenderer imageUrl={imageUrl} />}
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

ImageGenNodeComponent.displayName = "ImageGenNode";

export { ImageGenNodeComponent };
