import type { FileData } from "@gatewai/types";
import type { NodeProps } from "@xyflow/react";
import { memo } from "react";
import { useAppSelector } from "@/store";
import { makeSelectNodeById } from "@/store/nodes";
import { ResolveFileDataUrl } from "@/utils/file";
import { useNodeResult } from "../../processor/processor-ctx";
import { BaseNode } from "../base";
import { CanvasRenderer } from "../common/canvas-renderer";
import type { BlurNode } from "../node-props";
import { BlurValueSlider } from "./blur-slider";

const BlurNodeComponent = memo((props: NodeProps<BlurNode>) => {
	const node = useAppSelector(makeSelectNodeById(props.id));
	const { result } = useNodeResult(props.id);
	const outputItem = result?.outputs[result.selectedOutputIndex].items[0];
	const inputFileData = outputItem?.data as FileData;
	const imageUrl = ResolveFileDataUrl(inputFileData);

	return (
		<BaseNode selected={props.selected} id={props.id} dragging={props.dragging}>
			<div className="flex flex-col gap-3 ">
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
