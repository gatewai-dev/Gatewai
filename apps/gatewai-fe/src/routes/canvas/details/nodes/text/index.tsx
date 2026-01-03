import type { TextResult } from "@gatewai/types";
import type { NodeProps } from "@xyflow/react";
import { memo } from "react";
import { Textarea } from "@/components/ui/textarea";
import { useCanvasCtx } from "../../ctx/canvas-ctx";
import { useNodeResult } from "../../processor/processor-ctx";
import { BaseNode } from "../base";
import type { TextNode } from "../node-props";

const TextNodeComponent = memo((props: NodeProps<TextNode>) => {
	const { onNodeResultUpdate } = useCanvasCtx();
	const { result } = useNodeResult(props.id);
	const textResult = result as unknown as TextResult;
	const text = textResult?.outputs?.[0]?.items?.[0]?.data ?? "";

	const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		const newResult: TextResult = {
			selectedOutputIndex: 0,
			outputs: [
				{
					items: [
						{
							outputHandleId:
								textResult?.outputs?.[0]?.items?.[0]?.outputHandleId,
							type: "Text",
							data: e.target.value,
						},
					],
				},
			],
		};
		onNodeResultUpdate({ id: props.id, newResult });
	};

	return (
		<BaseNode {...props} className="nowheel">
			<Textarea
				value={text}
				onChange={handleChange}
				className="w-full h-full max-h-full overflow-auto p-2 border rounded text-gray-100 resize-none text-xs!"
				placeholder="Enter text..."
			/>
		</BaseNode>
	);
});
TextNodeComponent.displayName = "TextNode";

export { TextNodeComponent };
