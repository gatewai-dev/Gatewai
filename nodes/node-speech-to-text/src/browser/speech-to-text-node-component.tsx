import type { SpeechToTextResult } from "@gatewai/core/types";
import { OutputSelector, RunNodeButton } from "@gatewai/node-sdk/browser";
import {
	BaseNode,
	MarkdownRenderer,
	useNodeResult,
} from "@gatewai/react-canvas";
import {
	makeSelectNodeById,
	ScrollArea,
	useAppSelector,
} from "@gatewai/react-store";
import { cn } from "@gatewai/ui-kit";
import { memo, useMemo } from "react";

const SpeechToTextNodeComponent = memo(
	(props: { selected: boolean; id: string; dragging: boolean }) => {
		const { result } = useNodeResult<SpeechToTextResult>(props.id);
		const node = useAppSelector(makeSelectNodeById(props.id));
		const hasMoreThanOneOutput = result?.outputs && result?.outputs?.length > 1;

		const transcription = useMemo(() => {
			if (!result || !result.outputs) return null;
			const selectedOutput = result.outputs[result.selectedOutputIndex || 0];
			if (
				selectedOutput?.items?.[0]?.data &&
				typeof selectedOutput.items[0].data === "string"
			) {
				return selectedOutput.items[0].data;
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
					{transcription && (
						<ScrollArea
							viewPortCn="max-h-[350px]"
							className={cn("text-xs bg-input p-2 w-full", {
								"pt-8": hasMoreThanOneOutput,
							})}
						>
							<MarkdownRenderer className="text-sm" markdown={transcription} />
						</ScrollArea>
					)}
					{!transcription && (
						<div className="min-h-[100px] w-full bg-input max-h-full p-2 flex items-center justify-center">
							<p className="text-xs text-gray-500">
								Transcription will appear here.
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
