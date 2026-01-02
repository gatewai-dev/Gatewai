import type { LLMResult } from "@gatewai/types";
import type { NodeProps } from "@xyflow/react";
import { InfoIcon } from "lucide-react";
import { memo, useMemo } from "react";
import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@/components/ui/accordion";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { useAppSelector } from "@/store";
import { makeSelectHandlesByNodeId } from "@/store/handles";
import { AddCustomHandleButton } from "../../components/add-custom-handle";
import { RunNodeButton } from "../../components/run-node-button";
import { useNodeTaskRunning } from "../../ctx/task-manager-ctx";
import { useNodeResult } from "../../processor/processor-ctx";
import { BaseNode } from "../base";
import type { LLMNode } from "../node-props";

function AgentNodeHandbook() {
	return (
		<Accordion type="single" collapsible defaultValue="info">
			<AccordionItem value="info">
				<AccordionTrigger className="text-[8px] py-2 gap-1 flex justify-start items-center">
					<InfoIcon className="size-2" />
					Handbook
				</AccordionTrigger>
				<AccordionContent>
					<Alert>
						<InfoIcon className="size-3" />
						<AlertDescription className="text-[8px]">
							<ul className="list-disc pl-4">
								<li>Add inputs and outputs for the agent.</li>
								<li>
									After running the node, the output handles will contain the
									data.
								</li>
								<li>Inputs and outputs cannot be added after the first run.</li>
								<li>
									The agent has the capabilities of almost all other nodes
									(e.g., image filters, image composition).
								</li>
							</ul>
						</AlertDescription>
					</Alert>
				</AccordionContent>
			</AccordionItem>
		</Accordion>
	);
}

const AgentNodeComponent = memo((props: NodeProps<LLMNode>) => {
	const { result } = useNodeResult<LLMResult>(props.id);
	const selectHandles = useMemo(
		() => makeSelectHandlesByNodeId(props.id),
		[props.id],
	);
	const handles = useAppSelector(selectHandles);
	const isNodeRunning = useNodeTaskRunning(props.id);
	const numOutputHandles = handles.filter((h) => h.type === "Output").length;
	const numInputHandles = handles.filter((h) => h.type === "Input").length;

	const maxHandleNum = Math.max(numInputHandles, numOutputHandles);
	const hasResult = result?.outputs && result?.outputs?.length > 0;
	return (
		<BaseNode {...props}>
			<div
				style={{
					minHeight: 30 * maxHandleNum,
				}}
			>
				<div className="flex flex-col justify-between h-full gap-2">
					<AgentNodeHandbook />
					{!hasResult && !isNodeRunning && (
						<div className="justify-between flex">
							<AddCustomHandleButton nodeProps={props} type="Input" />
							<Separator orientation="vertical" className="mx-2" />
							<AddCustomHandleButton nodeProps={props} type="Output" />
						</div>
					)}
				</div>
			</div>
			<Separator className="my-2" />
			<div className="flex flex-col gap-2 items-end nowheel">
				<RunNodeButton nodeProps={props} />
			</div>
		</BaseNode>
	);
});

export { AgentNodeComponent };
