import { ResolveFileDataUrl } from "@gatewai/core/browser";
import type { ConnectedInput, FileData } from "@gatewai/core/types";
import {
	useNodePreview,
	useNodeResult,
	useNodeUI,
} from "@gatewai/node-sdk/browser";
import {
	updateNodeConfigWithoutHistory,
	useAppDispatch,
} from "@gatewai/react-store";
import { cn } from "@gatewai/ui-kit";
import type { NodeProps } from "@xyflow/react";
import { memo, useEffect } from "react";
import type { ResizeNodeConfig } from "@/shared/config.js";
import { ResizeConfig } from "./resize-node-config.js";

const ResizeNodeComponent = memo((props: NodeProps) => {
	const { BaseNode, CanvasRenderer } = useNodeUI();
	const { imageUrl, node } = useNodePreview(props.id);
	const dispatch = useAppDispatch();

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

export { ResizeNodeComponent };
