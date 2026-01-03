import type { NodeProps } from "@xyflow/react";
import { ImagesIcon } from "lucide-react";
import { memo } from "react";
import { useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { useAppSelector } from "@/store";
import { makeSelectNodeById } from "@/store/nodes";
import { AddCustomHandleButton } from "../../components/add-custom-handle";
import { useNodeFileOutputUrl } from "../../processor/processor-ctx";
import { BaseNode } from "../base";
import { CanvasRenderer } from "../common/canvas-renderer";
import type { CompositorNode } from "../node-props";

const CompositorNodeComponent = memo((props: NodeProps<CompositorNode>) => {
	const node = useAppSelector(makeSelectNodeById(props.id));
	const imageUrl = useNodeFileOutputUrl(props.id);
	const nav = useNavigate();

	return (
		<BaseNode {...props}>
			<div className="flex flex-col gap-3 ">
				<div className="w-full overflow-hidden rounded media-container relative">
					{imageUrl && <CanvasRenderer imageUrl={imageUrl} />}
				</div>
				<div className="flex justify-between items-center">
					<AddCustomHandleButton
						dataTypes={["Image", "Text"]}
						nodeProps={props}
						type="Input"
					/>
					{node && (
						<Button onClick={() => nav(`designer/${node.id}`)} size="sm">
							<ImagesIcon /> Edit
						</Button>
					)}
				</div>
			</div>
		</BaseNode>
	);
});

CompositorNodeComponent.displayName = "CompositorNodeComponent";

export { CompositorNodeComponent };
