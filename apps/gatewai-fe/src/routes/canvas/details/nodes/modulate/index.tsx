import type { FileData } from "@gatewai/types";
import { memo } from "react";
import { useAppSelector } from "@/store";
import { makeSelectNodeById } from "@/store/nodes";
import { ResolveFileDataUrl } from "@/utils/file";
import { useNodeResult } from "../../processor/processor-ctx";
import { BaseNode } from "../base";
import { CanvasRenderer } from "../common/canvas-renderer";
import { ModulateNodeConfigComponent } from "./modulate-config";

const ModulateNodeComponent = memo(
	(props: { selected: boolean; id: string; dragging: boolean }) => {
		const node = useAppSelector(makeSelectNodeById(props.id));

		const { result } = useNodeResult(props.id);
		const outputItem = result?.outputs[result.selectedOutputIndex].items[0];
		const inputFileData = outputItem?.data as FileData;

		const imageUrl = ResolveFileDataUrl(inputFileData);

		return (
			<BaseNode
				selected={props.selected}
				id={props.id}
				dragging={props.dragging}
			>
				<div className="flex flex-col gap-3 ">
					<div className="w-full overflow-hidden rounded media-container relative">
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
