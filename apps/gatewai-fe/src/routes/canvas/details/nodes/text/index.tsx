import { makeSelectNodeById, useAppSelector } from "@gatewai/react-store";
import type { TextNodeConfig } from "@gatewai/types";
import { ScrollArea, Textarea } from "@gatewai/ui-kit";
import type { NodeProps } from "@xyflow/react";
import { memo, useCallback } from "react";
import { useCanvasCtx } from "../../ctx/canvas-ctx";
import { BaseNode } from "../base";
import type { TextNode } from "../node-props";

const TextNodeComponent = memo((props: NodeProps<TextNode>) => {
	const { onNodeConfigUpdate } = useCanvasCtx();
	const node = useAppSelector(makeSelectNodeById(props.id));
	const textResult = node?.config as TextNodeConfig;
	const text = textResult?.content ?? "";

	const handleChange = useCallback(
		(e: React.ChangeEvent<HTMLTextAreaElement>) => {
			const newConfig: TextNodeConfig = {
				content: e.target.value,
			};
			onNodeConfigUpdate({ id: props.id, newConfig });
		},
		[onNodeConfigUpdate, props.id],
	);

	return (
		<BaseNode {...props} className="nowheel">
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
TextNodeComponent.displayName = "TextNode";

export { TextNodeComponent };
