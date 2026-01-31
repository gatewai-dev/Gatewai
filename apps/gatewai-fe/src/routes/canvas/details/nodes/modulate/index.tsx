import { memo } from "react";
import { cn } from "@/lib/utils";
import { useNodePreview } from "../../hooks/node-preview";
import { BaseNode } from "../base";
import { CanvasRenderer } from "../common/canvas-renderer";
import { ModulateNodeConfigComponent } from "./modulate-config";

const ModulateNodeComponent = memo(
	(props: { selected: boolean; id: string; dragging: boolean }) => {
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

					{node && <ModulateNodeConfigComponent node={node} />}
				</div>
			</BaseNode>
		);
	},
);

ModulateNodeComponent.displayName = "ModulateNodeComponent";

export { ModulateNodeComponent };
