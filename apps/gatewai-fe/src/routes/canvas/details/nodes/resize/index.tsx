import type { ResizeNodeConfig } from "@gatewai/types";
import type { NodeProps } from "@xyflow/react";
import { memo, useEffect, useRef } from "react";
import { useAppDispatch, useAppSelector } from "@/store";
import { makeSelectNodeById, updateNodeConfig } from "@/store/nodes";
import { useNodeFileOutputUrl } from "../../processor/processor-ctx";
import { BaseNode } from "../base";
import { CanvasRenderer } from "../common/canvas-renderer";
import { DimensionsConfig } from "../common/dimensions";
import type { ResizeNode } from "../node-props";

const ResizeNodeComponent = memo((props: NodeProps<ResizeNode>) => {
	const node = useAppSelector(makeSelectNodeById(props.id));
	const dispatch = useAppDispatch();

	const imageUrl = useNodeFileOutputUrl(props.id);

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
		<BaseNode {...props}>
			<div className="flex flex-col gap-3">
				<div className="w-full media-container overflow-hidden rounded min-h-[100px] relative">
					<CanvasRenderer imageUrl={imageUrl} />
				</div>
				{node && <DimensionsConfig node={node} />}
			</div>
		</BaseNode>
	);
});

ResizeNodeComponent.displayName = "ResizeNodeComponent";

export { ResizeNodeComponent };
