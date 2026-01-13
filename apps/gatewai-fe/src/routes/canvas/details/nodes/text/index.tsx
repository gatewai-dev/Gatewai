import type { TextNodeConfig } from "@gatewai/types";
import type { NodeProps } from "@xyflow/react";
import { memo, useCallback } from "react";
import { Textarea } from "@/components/ui/textarea";
import { useAppSelector } from "@/store";
import { makeSelectNodeById } from "@/store/nodes";
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
			<Textarea
				value={text}
				onChange={handleChange}
				className="w-full h-full max-h-80 overflow-auto p-2 border rounded text-gray-100 resize-none text-xs!"
				placeholder="Enter text..."
			/>
		</BaseNode>
	);
});
TextNodeComponent.displayName = "TextNode";

export { TextNodeComponent };
