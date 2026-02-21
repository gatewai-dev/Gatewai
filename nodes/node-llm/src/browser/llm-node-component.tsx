import type { LLMResult } from "../shared/index.js";

import {
	AddCustomHandleButton,
	BaseNode,
	OutputSelector,
	RunNodeButton,
	useNodeResult,
} from "@gatewai/react-canvas";
import { makeSelectNodeById, useAppSelector } from "@gatewai/react-store";
import { cn, MarkdownRenderer, ScrollArea } from "@gatewai/ui-kit";
import { memo, useMemo } from "react";

const LlmNodeComponent = memo(
	(props: { selected: boolean; id: string; dragging: boolean }) => {
		const { result } = useNodeResult<LLMResult>(props.id);
		const node = useAppSelector(makeSelectNodeById(props.id));
		const hasMoreThanOneOutput = result?.outputs && result?.outputs?.length > 1;

		const llmTextContent = useMemo(() => {
			if (!result || !result.outputs) return null;
			const selectedGeneration =
				result.outputs[result.selectedOutputIndex || 0];
			if (
				selectedGeneration?.items?.[0]?.data &&
				typeof selectedGeneration.items[0].data === "string"
			) {
				return selectedGeneration.items[0].data;
			}
			return null;
		}, [result]);
		return (
			<BaseNode
				selected={props.selected}
				id={props.id}
				dragging={props.dragging}
			>
				<div className="flex flex-col items-end nowheel relative">
					{hasMoreThanOneOutput && (
						<div className="absolute top-1 left-1 z-10">
							<OutputSelector node={node} />
						</div>
					)}
					{llmTextContent && (
						<ScrollArea
							viewPortCn="max-h-[350px]"
							className={cn("text-xs bg-input p-2 w-full", {
								"pt-8": hasMoreThanOneOutput,
							})}
						>
							<MarkdownRenderer className="text-sm" markdown={llmTextContent} />
						</ScrollArea>
					)}
					{!llmTextContent && (
						<div className="min-h-[200px] w-full bg-input max-h-full p-2">
							<p className="text-xs text-gray-500">
								LLM result will display here.
							</p>
						</div>
					)}
					<div className="flex justify-between items-center w-full p-1.5">
						<AddCustomHandleButton
							nodeId={props.id}
							type="Input"
							label="Add Reference Image"
							dataTypes={node?.template.variableInputDataTypes}
						/>
						<RunNodeButton nodeId={props.id} />
					</div>
				</div>
			</BaseNode>
		);
	},
);

export { LlmNodeComponent };
