import { ResolveFileDataUrl } from "@gatewai/core/browser";
import type { FileData } from "@gatewai/core/types";
import { AddCustomHandleButton } from "@gatewai/node-sdk/client";
import { BaseNode, CanvasRenderer, useNodeResult } from "@gatewai/react-canvas";
import { makeSelectNodeById, useAppSelector } from "@gatewai/react-store";
import { Button } from "@gatewai/ui-kit";
import type { NodeProps } from "@xyflow/react";
import { ImagesIcon } from "lucide-react";
import { memo } from "react";
import { useNavigate } from "react-router";
import { cn } from "@/lib/utils";
import type { CompositorNode } from "../node-props";

const CompositorNodeComponent = memo((props: NodeProps<CompositorNode>) => {
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

CompositorNodeComponent.displayName = "CompositorNodeComponent";

export { CompositorNodeComponent };
