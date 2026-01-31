import type { FileData, ResizeNodeConfig } from "@gatewai/types";
import type { NodeProps } from "@xyflow/react";
import { memo, useEffect } from "react";
import { ResolveFileDataUrl } from "@/lib/file";
import { cn } from "@/lib/utils";
import { useAppDispatch } from "@/store";
import { updateNodeConfigWithoutHistory } from "@/store/nodes";
import { useNodeResult } from "../../graph-engine/processor-ctx";
import type { ConnectedInput } from "../../graph-engine/types";
import { useNodePreview } from "../../hooks/node-preview";
import { BaseNode } from "../base";
import { CanvasRenderer } from "../common/canvas-renderer";
import type { ResizeNode } from "../node-props";
import { ResizeConfig } from "./resize-config";

const ResizeNodeComponent = memo((props: NodeProps<ResizeNode>) => {
	const dispatch = useAppDispatch();
	const { imageUrl, node } = useNodePreview(props.id);

	const { inputs } = useNodeResult(props.id);

	const nodeConfig = node?.config as ResizeNodeConfig | null;

	// Update original dimensions from connected input
	useEffect(() => {
		if (!node || !inputs) return;

		// Find the first valid image input
		const imageInput = Object.values(inputs).find(
			(input: ConnectedInput) =>
				input.connectionValid &&
				input.outputItem?.type === "Image" &&
				input.outputItem.data,
		);

		if (!imageInput?.outputItem) return;

		const url = ResolveFileDataUrl(imageInput.outputItem.data as FileData);
		if (!url) return;

		const img = new Image();
		img.crossOrigin = "anonymous";
		img.src = url;

		img.onload = () => {
			// Update if dimensions are missing or different (e.g. input changed)
			if (
				nodeConfig?.originalWidth !== img.width ||
				nodeConfig?.originalHeight !== img.height
			) {
				dispatch(
					updateNodeConfigWithoutHistory({
						id: node.id,
						newConfig: {
							...nodeConfig,
							originalWidth: img.width,
							originalHeight: img.height,
						},
					}),
				);
			}
		};
	}, [dispatch, inputs, node, nodeConfig]);

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
				{node && <ResizeConfig node={node} />}
			</div>
		</BaseNode>
	);
});

ResizeNodeComponent.displayName = "ResizeNodeComponent";

export { ResizeNodeComponent };
