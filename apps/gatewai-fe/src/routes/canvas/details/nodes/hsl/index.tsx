import type { NodeProps } from "@xyflow/react";
import { memo, useEffect, useRef } from "react";
import { useAppSelector } from "@/store";
import { makeSelectNodeById } from "@/store/nodes";
import { useDrawToCanvas } from "../../hooks/use-draw-to-canvas";
import { useNodeFileOutputUrl } from "../../processor/processor-ctx";
import { BaseNode } from "../base";
import type { BlurNode } from "../node-props";

const BlurNodeComponent = memo((props: NodeProps<BlurNode>) => {
	const node = useAppSelector(makeSelectNodeById(props.id));
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const imageUrl = useNodeFileOutputUrl(props.id);

	// Draw to canvas when result is ready
	useDrawToCanvas(canvasRef, imageUrl);

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
