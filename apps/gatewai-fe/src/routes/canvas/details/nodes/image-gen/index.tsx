import { memo, useEffect, useRef } from "react";
import { type NodeProps } from "@xyflow/react";
import { useAppSelector } from "@/store";
import { makeSelectNodeById } from "@/store/nodes";
import { BaseNode } from "../base";
import type { ImageGenNode } from "../node-props";
import { RunNodeButton } from "../../components/run-node-button";
import { CreateHandleButton } from "./create-handle-button";
import { useNodeImageUrl, useNodeResult } from "../../processor/processor-ctx";
import { OutputSelector } from "../misc/output-selector";

const ImagePlaceholder = () => (
	<div className="w-full media-container h-[280px] flex items-center justify-center rounded bg-gray-50 dark:bg-gray-800 border border-dashed border-gray-300 dark:border-gray-700">
		<span className="text-gray-400 text-sm">No image generated</span>
	</div>
);

const ImageGenNodeComponent = memo((props: NodeProps<ImageGenNode>) => {
	const node = useAppSelector(makeSelectNodeById(props.id));

	const { result, error } = useNodeResult(props.id);
	const imageUrl = useNodeImageUrl(props.id);
	const canvasRef = useRef<HTMLCanvasElement | null>(null);

	useEffect(() => {
		if (!imageUrl || !canvasRef.current) return;

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
		};
	}, [imageUrl]);
	const hasMoreThanOneOutput = result?.outputs && result?.outputs?.length > 1;

	return (
		<BaseNode {...props}>
			<div className="flex flex-col gap-3">
				{!result ? (
					<ImagePlaceholder />
				) : (
					<div className="w-full overflow-hidden rounded bg-black/5 min-h-[100px] relative">
						{hasMoreThanOneOutput && (
							<div className="absolute top-1 left-1 z-10">
								<OutputSelector node={node} />
							</div>
						)}
						<canvas ref={canvasRef} className="block w-full h-auto" />
					</div>
				)}

				<div className="flex justify-between items-center w-full">
					<CreateHandleButton nodeProps={props} />
					<RunNodeButton nodeProps={props} />
				</div>
			</div>
		</BaseNode>
	);
});
ImageGenNodeComponent.displayName = "ImageGenNode";

export { ImageGenNodeComponent };
