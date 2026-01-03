import type { LLMResult } from "@gatewai/types";
import type { NodeProps } from "@xyflow/react";
import { memo, useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MarkdownRenderer } from "../../components/markdown-renderer";
import { RunNodeButton } from "../../components/run-node-button";
import { useNodeResult } from "../../processor/processor-ctx";
import { BaseNode } from "../base";
import type { LLMNode } from "../node-props";

const LlmNodeComponent = memo((props: NodeProps<LLMNode>) => {
	const { result } = useNodeResult<LLMResult>(props.id);

	const llmTextContent = useMemo(() => {
		if (!result || !result.outputs || result?.outputs?.length === 0)
			return null;
		const selectedGeneration = result.outputs[result.selectedOutputIndex || 0];
		if (
			selectedGeneration?.items?.[0]?.data &&
			typeof selectedGeneration.items[0].data === "string"
		) {
			return selectedGeneration.items[0].data;
		}
		return null;
	}, [result]);

	return (
		<BaseNode selected={props.selected} id={props.id} dragging={props.dragging}>
			<div className="flex flex-col gap-2 items-end nowheel">
				{llmTextContent && (
					<ScrollArea
						viewPortCn="max-h-[350px]"
						className="text-xs bg-input p-2  w-full "
					>
						<MarkdownRenderer markdown={llmTextContent} />
					</ScrollArea>
				)}
				{!llmTextContent && (
					<div className="min-h-[200px] w-full bg-input max-h-full p-2">
						<p className="text-xs text-gray-500">
							LLM result will display here.
						</p>
					</div>
				)}
				<RunNodeButton nodeProps={props} />
			</div>
		</BaseNode>
	);
});

export { LlmNodeComponent };
