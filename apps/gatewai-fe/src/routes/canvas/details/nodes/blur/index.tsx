import type { NodeProps } from "@xyflow/react";
import { memo, useEffect, useRef } from "react";
import { useAppSelector } from "@/store";
import { makeSelectNodeById } from "@/store/nodes";
import { useNodeImageUrl } from "../../processor/processor-ctx";
import { BaseNode } from "../base";
import type { BlurNode } from "../node-props";
import { BlurValueSlider } from "./blur-slider";

const BlurNodeComponent = memo((props: NodeProps<BlurNode>) => {
	const node = useAppSelector(makeSelectNodeById(props.id));
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const imageUrl = useNodeImageUrl(props.id);

	// Draw to canvas when result is ready
	useEffect(() => {
		if (!imageUrl || !canvasRef.current) return;

		const canvas = canvasRef.current;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		const img = new Image();
		img.crossOrigin = "anonymous";
		img.src = imageUrl;
		console.log("drw");
		img.onload = () => {
			canvas.width = img.width;
			canvas.height = img.height;
			canvas.style.width = "100%";
			canvas.style.height = "auto";
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			ctx.drawImage(img, 0, 0);
		};
	}, [imageUrl]);

	return (
		<BaseNode {...props}>
			<div className="flex flex-col gap-3 ">
				<div className="w-full overflow-hidden rounded media-container relative">
					<canvas ref={canvasRef} className="block w-full h-auto" />
				</div>

				{node && (
					<div className="flex gap-3 items-end p-1">
						<BlurValueSlider node={node} />
					</div>
				)}
			</div>
		</BaseNode>
	);
});

BlurNodeComponent.displayName = "BlurNodeComponent";

export { BlurNodeComponent };
