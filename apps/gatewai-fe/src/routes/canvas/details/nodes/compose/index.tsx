import type { NodeProps } from "@xyflow/react";
import { memo, useRef } from "react";
import { useAppSelector } from "@/store";
import { makeSelectNodeById } from "@/store/nodes";
import { AddCustomHandleButton } from "../../components/add-custom-handle";
import { useDrawToCanvas } from "../../hooks/use-draw-to-canvas";
import { useNodeFileOutputUrl } from "../../processor/processor-ctx";
import { BaseNode } from "../base";
import type { CompositorNode } from "../node-props";
import { DesignDialog } from "./design-dialog";

const CompositorNodeComponent = memo((props: NodeProps<CompositorNode>) => {
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
				<div className="flex justify-between items-center">
					<AddCustomHandleButton
						dataTypes={["Image", "Text"]}
						nodeProps={props}
						type="Input"
					/>
					{node && <DesignDialog node={node} />}
				</div>
			</div>
		</BaseNode>
	);
});

CompositorNodeComponent.displayName = "CompositorNodeComponent";

export { CompositorNodeComponent };
