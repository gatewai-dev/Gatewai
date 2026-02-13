import { defineClient, useNodeUI } from "@gatewai/node-sdk";
import { ScrollArea, Textarea } from "@gatewai/ui-kit";
import type React from "react";
import { memo, useCallback } from "react";
import { metadata } from "../metadata.js";

const TextNodeComponent = memo((props: any) => {
	const { onNodeConfigUpdate, useNodePreview, BaseNode } = useNodeUI();
	const { node } = useNodePreview(props.id);
	const text = node?.config?.content ?? "";

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

TextNodeComponent.displayName = "TextNodeComponent";

export default defineClient(metadata, {
	Component: TextNodeComponent,
});
