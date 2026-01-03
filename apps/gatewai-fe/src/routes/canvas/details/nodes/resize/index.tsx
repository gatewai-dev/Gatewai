import type { ResizeNodeConfig } from "@gatewai/types";
import type { NodeProps } from "@xyflow/react";
import { memo, useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/store";
import { makeSelectNodeById, updateNodeConfig } from "@/store/nodes";
import { imageStore } from "../../processor/image-store";
import { useNodeResultHash } from "../../processor/processor-ctx";
import { BaseNode } from "../base";
import { CanvasRenderer } from "../common/canvas-renderer";
import { DimensionsConfig } from "../common/dimensions";
import type { ResizeNode } from "../node-props";

const ResizeNodeComponent = memo((props: NodeProps<ResizeNode>) => {
	const node = useAppSelector(makeSelectNodeById(props.id));
	const dispatch = useAppDispatch();

	const resultHash = useNodeResultHash(props.id);

	const nodeConfig = node?.config as ResizeNodeConfig | null;
	// Draw to canvas when result is ready
	useEffect(() => {
		if (!resultHash || !node) return;

		if (
			nodeConfig?.originalHeight == null ||
			nodeConfig?.originalWidth == null
		) {
			const img = new Image();
			img.crossOrigin = "anonymous";
			const imageUrl = imageStore.getDataUrlForHash(resultHash);
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
	}, [dispatch, resultHash, node, nodeConfig]);

	return (
		<BaseNode selected={props.selected} id={props.id} dragging={props.dragging}>
			<div className="flex flex-col gap-3">
				<div className="w-full media-container overflow-hidden rounded min-h-[100px] relative">
					<CanvasRenderer resultHash={resultHash} />
				</div>
				{node && <DimensionsConfig node={node} />}
			</div>
		</BaseNode>
	);
});

ResizeNodeComponent.displayName = "ResizeNodeComponent";

export { ResizeNodeComponent };
