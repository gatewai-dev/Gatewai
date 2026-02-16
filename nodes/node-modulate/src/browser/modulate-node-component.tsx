import { useNodePreview, useNodeUI } from "@gatewai/node-sdk/browser";
import { cn } from "@gatewai/ui-kit";
import { memo } from "react";
import { ModulateConfigComponent } from "./modulate-config-component.js";

const ModulateNodeComponent = memo(
	(props: { selected: boolean; id: string; dragging: boolean }) => {
		const { BaseNode, CanvasRenderer } = useNodeUI();
		const { imageUrl, node } = useNodePreview(props.id);

		return (
			<BaseNode
				selected={props.selected}
				id={props.id}
				dragging={props.dragging}
			>
				<div className="flex flex-col gap-3 ">
					<div
						className={cn("w-full overflow-hidden rounded media-container", {
							"min-h-32": !imageUrl,
							"h-full": imageUrl,
						})}
					>
						{imageUrl && <CanvasRenderer imageUrl={imageUrl} />}
					</div>

					{node && <ModulateConfigComponent node={node} />}
				</div>
			</BaseNode>
		);
	},
);

export { ModulateNodeComponent };
