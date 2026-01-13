import type { FileData } from "@gatewai/types";
import { memo } from "react";
import { useAppSelector } from "@/store";
import { makeSelectNodeById } from "@/store/nodes";
import { GetAssetEndpoint } from "@/utils/file";
import { RunNodeButton } from "../../components/run-node-button";
import { useNodeResult } from "../../processor/processor-ctx";
import { BaseNode } from "../base";
import { CanvasRenderer } from "../common/canvas-renderer";
import { CreateHandleButton } from "../common/create-handle-button";
import { OutputSelector } from "../misc/output-selector";

const ImageGenNodeComponent = memo(
	(props: { selected: boolean; id: string; dragging: boolean }) => {
		const node = useAppSelector(makeSelectNodeById(props.id));
		const { result } = useNodeResult(props.id);
		const outputItem = result?.outputs[result.selectedOutputIndex]?.items[0];
		const inputFileData = outputItem?.data as FileData;
		const imageUrl =
			inputFileData?.processData?.dataUrl ??
			(inputFileData?.entity ? GetAssetEndpoint(inputFileData.entity) : null);

		const hasMoreThanOneOutput = result?.outputs && result?.outputs?.length > 1;
		return (
			<BaseNode
				selected={props.selected}
				id={props.id}
				dragging={props.dragging}
			>
				<div className="flex flex-col gap-3">
					<div className="media-container w-full overflow-hidden rounded  min-h-32 relative">
						{hasMoreThanOneOutput && (
							<div className="absolute top-1 left-1 z-10">
								<OutputSelector node={node} />
							</div>
						)}
						{imageUrl && <CanvasRenderer imageUrl={imageUrl} />}
					</div>

					<div className="flex justify-between items-center w-full">
						<CreateHandleButton nodeId={props.id} />
						<RunNodeButton nodeId={props.id} />
					</div>
				</div>
			</BaseNode>
		);
	},
);
ImageGenNodeComponent.displayName = "ImageGenNode";

export { ImageGenNodeComponent };
