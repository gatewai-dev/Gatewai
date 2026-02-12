import type { SpeechToTextResult } from "@gatewai/core/types";
import { OutputSelector, RunNodeButton } from "@gatewai/node-sdk/client";
import { BaseNode, useNodeResult } from "@gatewai/react-canvas";
import { makeSelectNodeById, useAppSelector } from "@gatewai/react-store";
import { ScrollArea } from "@gatewai/ui-kit";
import { memo, useMemo } from "react";
import { cn } from "@/lib/utils";
import { MarkdownRenderer } from "../../components/markdown-renderer";

const SpeechToTextNodeComponent = memo(
	(props: { selected: boolean; id: string; dragging: boolean }) => {
		const { result } = useNodeResult<SpeechToTextResult>(props.id);
		const node = useAppSelector(makeSelectNodeById(props.id));
		const hasMoreThanOneOutput = result?.outputs && result?.outputs?.length > 1;

		const SpeechToTextTextContent = useMemo(() => {
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
				<div className="flex flex-col gap-2 items-end nowheel relative">
					{hasMoreThanOneOutput && (
						<div className="absolute top-1 left-1 z-10">
							<OutputSelector node={node} />
						</div>
					)}
					{SpeechToTextTextContent && (
						<ScrollArea
							viewPortCn="max-h-[350px]"
							className={cn("text-xs bg-input p-2 w-full", {
								"pt-8": hasMoreThanOneOutput,
							})}
						>
							<MarkdownRenderer
								className="text-sm"
								markdown={SpeechToTextTextContent}
							/>
						</ScrollArea>
					)}
					{!SpeechToTextTextContent && (
						<div className="min-h-[200px] w-full bg-input max-h-full p-2">
							<p className="text-xs text-gray-500">
								The result will display here.
							</p>
						</div>
					)}
					<RunNodeButton nodeId={props.id} />
				</div>
			</BaseNode>
		);
	},
);

export { SpeechToTextNodeComponent };
