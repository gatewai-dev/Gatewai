import type { ResizeNodeConfig } from "@gatewai/types";
import type { NodeProps } from "@xyflow/react";
import { memo, useEffect, useRef } from "react";
import { useAppDispatch, useAppSelector } from "@/store";
import { makeSelectNodeById, updateNodeConfig } from "@/store/nodes";
import { useNodeImageUrl, useNodeResult } from "../../processor/processor-ctx";
import { BaseNode } from "../base";
import { DimensionsConfig } from "../common/dimensions";
import type { ResizeNode } from "../node-props";

const ImagePlaceholder = () => {
	return (
		<div className="w-full media-container h-[280px] flex items-center justify-center rounded">
			<span className="text-gray-400 text-sm">No image connected</span>
		</div>
	);
};

const ResizeNodeComponent = memo((props: NodeProps<ResizeNode>) => {
	const node = useAppSelector(makeSelectNodeById(props.id));
	const dispatch = useAppDispatch();
	const canvasRef = useRef<HTMLCanvasElement | null>(null);

	const imageUrl = useNodeImageUrl(props.id);

	const nodeConfig = node?.config as ResizeNodeConfig | null;
	// Draw to canvas when result is ready
	useEffect(() => {
		if (!imageUrl || !canvasRef.current || !node) return;

		const canvas = canvasRef.current;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		const img = new Image();
		img.crossOrigin = "anonymous";
		img.src = imageUrl;

		img.onload = () => {
			canvas.width = img.width;
			canvas.height = img.height;
			canvas.style.width = "100%";
			canvas.style.height = "auto";
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			ctx.drawImage(img, 0, 0);
			if (
				nodeConfig?.originalHeight == null ||
				nodeConfig?.originalWidth == null
			) {
				console.log({ ow: img.width, oh: img.height });
				// Set original dimensions in node config
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
			}
		};
	}, [dispatch, imageUrl, node, nodeConfig]);

	return (
		<BaseNode {...props}>
			<div className="flex flex-col gap-3">
				<div className="w-full media-container overflow-hidden rounded bg-black/5 min-h-[100px] relative">
					<canvas ref={canvasRef} className="block w-full h-auto" />
				</div>
				{node && <DimensionsConfig node={node} />}
			</div>
		</BaseNode>
	);
});

ResizeNodeComponent.displayName = "ResizeNodeComponent";

export { ResizeNodeComponent };
