import { memo } from "react";
import { useAppSelector } from "@/store";
import { makeSelectNodeById } from "@/store/nodes";
import { useNodeResultHash } from "../../processor/processor-ctx";
import { BaseNode } from "../base";
import { CanvasRenderer } from "../common/canvas-renderer";
import { ModulateNodeConfigComponent } from "./modulate-config";

const ModulateNodeComponent = memo(
	(props: { selected: boolean; id: string; dragging: boolean }) => {
		const node = useAppSelector(makeSelectNodeById(props.id));
		const resultHash = useNodeResultHash(props.id);

		return (
			<BaseNode
				selected={props.selected}
				id={props.id}
				dragging={props.dragging}
			>
				<div className="flex flex-col gap-3 ">
					<div className="w-full overflow-hidden rounded media-container relative">
						{resultHash && <CanvasRenderer resultHash={resultHash} />}
					</div>

					{node && <ModulateNodeConfigComponent node={node} />}
				</div>
			</BaseNode>
		);
	},
);

ModulateNodeComponent.displayName = "ModulateNodeComponent";

export { ModulateNodeComponent };
