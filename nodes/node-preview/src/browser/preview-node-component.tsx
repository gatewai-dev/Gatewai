import { BaseNode, MediaContent } from "@gatewai/react-canvas";
import { makeSelectNodeById, useAppSelector } from "@gatewai/react-store";
import { memo } from "react";

const PreviewNodeComponent = memo(
	(props: { id: string; selected: boolean; dragging: boolean }) => {
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

PreviewNodeComponent.displayName = "PreviewNode";

export { PreviewNodeComponent };
