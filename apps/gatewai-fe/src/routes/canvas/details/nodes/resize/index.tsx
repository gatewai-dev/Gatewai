import type { ResizeNodeConfig } from "@gatewai/types";
import type { NodeProps } from "@xyflow/react";
import { memo, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useAppDispatch } from "@/store";
import { updateNodeConfig } from "@/store/nodes";
import { useNodePreview } from "../../hooks/node-preview";
import { BaseNode } from "../base";
import { CanvasRenderer } from "../common/canvas-renderer";
import type { ResizeNode } from "../node-props";
import { ResizeConfig } from "./resize-config";

const ResizeNodeComponent = memo((props: NodeProps<ResizeNode>) => {
	const dispatch = useAppDispatch();
	const { imageUrl, node } = useNodePreview(props.id);

	const nodeConfig = node?.config as ResizeNodeConfig | null;
	//  When image connected, set dimensions to images
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
				{node && <ResizeConfig node={node} />}
			</div>
		</BaseNode>
	);
});

ResizeNodeComponent.displayName = "ResizeNodeComponent";

export { ResizeNodeComponent };
