import type { NodeProps } from "@xyflow/react";
import { memo, useEffect, useRef } from "react";
import { useAppSelector } from "@/store";
import { makeSelectNodeById } from "@/store/nodes";
import { RunNodeButton } from "../../components/run-node-button";
import {
	useNodeResult,
	useNodeResultHash,
} from "../../processor/processor-ctx";
import { BaseNode } from "../base";
import { CanvasRenderer } from "../common/canvas-renderer";
import { OutputSelector } from "../misc/output-selector";
import type { ImageGenNode } from "../node-props";
import { CreateHandleButton } from "./create-handle-button";

const ImageGenNodeComponent = memo((props: NodeProps<ImageGenNode>) => {
	const node = useAppSelector(makeSelectNodeById(props.id));

	const { result } = useNodeResult(props.id);
	const resultHash = useNodeResultHash(props.id);
	const hasMoreThanOneOutput = result?.outputs && result?.outputs?.length > 1;

	return (
		<BaseNode selected={props.selected} id={props.id} dragging={props.dragging}>
			<div className="flex flex-col gap-3">
				<div className="media-container w-full overflow-hidden rounded  min-h-[100px] relative">
					{hasMoreThanOneOutput && (
						<div className="absolute top-1 left-1 z-10">
							<OutputSelector node={node} />
						</div>
					)}
					{resultHash && <CanvasRenderer resultHash={resultHash} />}
				</div>

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
