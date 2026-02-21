import {
	BaseNode,
	MediaContent,
	type NodeProps,
	useNodeResult,
} from "@gatewai/react-canvas";
import { makeSelectNodeById, useAppSelector } from "@gatewai/react-store";
import { memo } from "react";

const PreviewNodeComponent = memo((props: NodeProps) => {
	const { result, error } = useNodeResult(props.id);
	const node = useAppSelector(makeSelectNodeById(props.id));

	if (!result || error || !node) {
		return (
			<BaseNode {...props}>
				<div className="flex flex-col items-center justify-center h-32">
					<p className="text-muted-foreground">Connect a node to preview</p>
				</div>
			</BaseNode>
		);
	}

	return (
		<BaseNode selected={props.selected} id={props.id} dragging={props.dragging}>
			<div className="-mx-0.5 mt-[-2px] mb-[-2px] overflow-hidden relative">
				<MediaContent node={node} result={result} />
			</div>
		</BaseNode>
	);
});

export { PreviewNodeComponent };
