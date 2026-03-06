import { AddCustomHandleButton, BaseNode } from "@gatewai/react-canvas";
import { makeSelectNodeById, useAppSelector } from "@gatewai/react-store";
import { memo } from "react";
import { TextMergerNodeConfigComponent } from "./text-merger-config-component.js";

const TextMergerNodeComponent = memo(
	(props: { id: string; selected: boolean; dragging: boolean }) => {
		const node = useAppSelector(makeSelectNodeById(props.id));

		return (
			<BaseNode
				selected={props.selected}
				id={props.id}
				dragging={props.dragging}
			>
				<div className="flex flex-col gap-3 ">
					{node && <TextMergerNodeConfigComponent node={node} />}
				</div>
				<div className="flex justify-between  p-1.5 items-center">
					<AddCustomHandleButton
						dataTypes={node?.template.variableInputDataTypes}
						nodeId={node?.id}
						placeholder="E.g. Second Part"
						type="Input"
					/>
				</div>
			</BaseNode>
		);
	},
);

export { TextMergerNodeComponent };
