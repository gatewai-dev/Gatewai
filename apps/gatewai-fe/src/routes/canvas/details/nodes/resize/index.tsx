import type { FileData, ResizeNodeConfig } from "@gatewai/types";
import type { NodeProps } from "@xyflow/react";
import { memo, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useAppDispatch, useAppSelector } from "@/store";
import { makeSelectNodeById, updateNodeConfig } from "@/store/nodes";
import { ResolveFileDataUrl } from "@/utils/file";
import { useNodeResult } from "../../processor/processor-ctx";
import { BaseNode } from "../base";
import { CanvasRenderer } from "../common/canvas-renderer";
import { DimensionsConfig } from "../common/dimensions";
import type { ResizeNode } from "../node-props";

const ResizeNodeComponent = memo((props: NodeProps<ResizeNode>) => {
	const node = useAppSelector(makeSelectNodeById(props.id));
	const dispatch = useAppDispatch();

	const { result } = useNodeResult(props.id);
	const outputItem = result?.outputs[result.selectedOutputIndex]?.items[0];
	const inputFileData = outputItem?.data as FileData;

	const imageUrl = ResolveFileDataUrl(inputFileData);

	const nodeConfig = node?.config as ResizeNodeConfig | null;
	// Draw to canvas when result is ready
	useEffect(() => {
		if (!imageUrl || !node) return;

		if (
			nodeConfig?.originalHeight == null ||
			nodeConfig?.originalWidth == null
		) {
			const img = new Image();
			img.crossOrigin = "anonymous";
			if (!imageUrl) {
				return;
			}
			img.src = imageUrl;
			// Set original dimensions in node config

			img.onload = () => {
				dispatch(
					updateNodeConfig({
						id: node.id,
						newConfig: {
							...nodeConfig,
							originalWidth: img.width,
							originalHeight: img.height,
						},
					}),
				);
			};
		}
	}, [dispatch, imageUrl, node, nodeConfig]);

	return (
		<BaseNode selected={props.selected} id={props.id} dragging={props.dragging}>
			<div className="flex flex-col gap-3">
				<div
					className={cn(
						"w-full media-container overflow-hidden rounded relative",
						{
							"h-92": imageUrl == null,
						},
					)}
				>
					{imageUrl && <CanvasRenderer imageUrl={imageUrl} />}
				</div>
				{node && <DimensionsConfig node={node} />}
			</div>
		</BaseNode>
	);
});

ResizeNodeComponent.displayName = "ResizeNodeComponent";

export { ResizeNodeComponent };
