import type { NodeProps } from "@xyflow/react";
import { memo } from "react";
import { useAppSelector } from "@gatewai/react-store";
import { makeSelectNodeById } from "@gatewai/react-store";
import { AddCustomHandleButton } from "../../components/add-custom-handle";
import { BaseNode } from "../base";
import type { TextMergerNode } from "../node-props";
import { TextMergerNodeConfigComponent } from "./text-merger-config";

const TextMergerNodeComponent = memo((props: NodeProps<TextMergerNode>) => {
	const node = useAppSelector(makeSelectNodeById(props.id));

	return (
		<BaseNode selected={props.selected} id={props.id} dragging={props.dragging}>
			<div className="flex flex-col gap-3 ">
				{node && <TextMergerNodeConfigComponent node={node} />}
			</div>
			<div className="flex justify-between mt-1 items-center">
				<AddCustomHandleButton
					dataTypes={node?.template.variableInputDataTypes}
					nodeId={node?.id}
					placeholder="E.g. Second Part"
					type="Input"
				/>
			</div>
		</BaseNode>
	);
});

TextMergerNodeComponent.displayName = "TextMergerNodeComponent";

export { TextMergerNodeComponent };
