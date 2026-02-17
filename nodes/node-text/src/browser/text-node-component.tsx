import { useNodePreview } from "@gatewai/node-sdk/browser";
import { BaseNode, type NodeProps, useCanvasCtx } from "@gatewai/react-canvas";
import { ScrollArea, Textarea } from "@gatewai/ui-kit";
import type React from "react";
import { memo, useCallback } from "react";

export const TextNodeComponent = memo((props: NodeProps) => {
	const { node } = useNodePreview(props.id);
	const text = node?.config?.content ?? "";

	const { onNodeConfigUpdate } = useCanvasCtx();
	const handleChange = useCallback(
		(e: React.ChangeEvent<HTMLTextAreaElement>) => {
			onNodeConfigUpdate({
				id: props.id,
				newConfig: { content: e.currentTarget.value },
			});
		},
		[onNodeConfigUpdate, props.id],
	);

	return (
		<BaseNode
			selected={props.selected}
			id={props.id}
			dragging={props.dragging}
			className="nowheel"
		>
			<ScrollArea
				viewPortCn="max-h-[350px]"
				className="text-xs bg-input w-full"
			>
				<Textarea
					value={text}
					onChange={handleChange}
					className="w-full h-full p-2 border rounded resize-none text-xs!"
					placeholder="Enter text..."
				/>
			</ScrollArea>
		</BaseNode>
	);
});
