import { useNodeUI } from "@gatewai/node-sdk/browser";
import { MediaContent } from "@gatewai/react-canvas";
import { makeSelectNodeById, useAppSelector } from "@gatewai/react-store";
import { memo } from "react";

const PreviewNodeComponent = memo(
	(props: { id: string; selected: boolean; dragging: boolean }) => {
		const { BaseNode } = useNodeUI();
		const node = useAppSelector(makeSelectNodeById(props.id));

		return (
			<BaseNode
				selected={props.selected}
				id={props.id}
				dragging={props.dragging}
			>
				<MediaContent node={node} />
			</BaseNode>
		);
	},
);

export { PreviewNodeComponent };
