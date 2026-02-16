import { ResolveFileDataUrl } from "@gatewai/core/browser";
import type { FileData } from "@gatewai/core/types";
import {
	AddCustomHandleButton,
	useNodeResult,
	useNodeUI,
} from "@gatewai/node-sdk/browser";
import { makeSelectNodeById, useAppSelector } from "@gatewai/react-store";
import { Button, cn } from "@gatewai/ui-kit";
import type { Node, NodeProps } from "@xyflow/react";
import { ImagesIcon } from "lucide-react";
import { memo } from "react";
import { useNavigate } from "react-router";

const CompositorNodeComponent = memo((props: NodeProps<Node>) => {
	const { BaseNode, CanvasRenderer } = useNodeUI();

	const node = useAppSelector(makeSelectNodeById(props.id));

	const { result } = useNodeResult(props.id);
	const outputItem = result?.outputs?.[result.selectedOutputIndex]?.items[0];
	const inputFileData = outputItem?.data as FileData;
	const imageUrl = ResolveFileDataUrl(inputFileData);

	const nav = useNavigate();
	return (
		<BaseNode selected={props.selected} id={props.id} dragging={props.dragging}>
			<div className="flex flex-col gap-3 ">
				<div
					className={cn(
						"w-full overflow-hidden rounded media-container relative",
						{
							"h-92": !imageUrl,
						},
					)}
				>
					{imageUrl && <CanvasRenderer imageUrl={imageUrl} />}
				</div>
				<div className="flex justify-between items-center">
					<AddCustomHandleButton
						dataTypes={node?.template.variableInputDataTypes}
						nodeId={props.id}
						type="Input"
					/>
					{node && (
						<Button onClick={() => nav(`designer/${node.id}`)} size="sm">
							<ImagesIcon /> Editor
						</Button>
					)}
				</div>
			</div>
		</BaseNode>
	);
});

export { CompositorNodeComponent };
