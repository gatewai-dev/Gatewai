import { memo } from "react";
import { AddCustomHandleButton } from "../../components/add-custom-handle";
import { RunNodeButton } from "../../components/run-node-button";
import { useNodePreview } from "../../hooks/node-preview";
import { MediaDimensions } from "../../misc/media-dimensions";
import { OutputSelector } from "../../misc/output-selector";
import { BaseNode } from "../base";
import { CanvasRenderer } from "../common/canvas-renderer";

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
						<div className="absolute bottom-1 left-1 z-10">
							<MediaDimensions node={node} />
						</div>
					</div>

					<div className="flex justify-between items-center w-full">
						<AddCustomHandleButton
							nodeId={props.id}
							type="Input"
							label="Add Reference Image"
							dataTypes={["Image"]}
						/>
						<RunNodeButton nodeId={props.id} />
					</div>
				</div>
			</BaseNode>
		);
	},
);

ImageGenNodeComponent.displayName = "ImageGenNode";

export { ImageGenNodeComponent };
