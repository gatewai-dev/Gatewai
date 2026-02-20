import {
	makeSelectAllNodes,
	selectSelectedNodes,
	useAppSelector,
} from "@gatewai/react-store";
import { Button } from "@gatewai/ui-kit";
import { ForwardIcon, Loader2 } from "lucide-react"; // Added Loader2
import { memo, useMemo } from "react";
import { useCanvasCtx } from "../../canvas-ctx";
import { useTaskManagerCtx } from "../../task-manager-ctx";

const RunWorkflowButton = memo(() => {
	const { runNodes } = useCanvasCtx();
	const { isAnyTaskRunning } = useTaskManagerCtx();

	const selectedNodes = useAppSelector(selectSelectedNodes);
	const nodes = useAppSelector(makeSelectAllNodes);

	const selectedTerminalNodes = selectedNodes?.filter(
		(f) => f.template.isTerminalNode,
	);
	const numberOfTerminalNodes = selectedTerminalNodes?.length;

	const hasAnyTerminalNode = useMemo(
		() => nodes.some((f) => f.template.isTerminalNode),
		[nodes],
	);

	const handleRunAll = () => {
		if (selectedTerminalNodes?.length) {
			const nodeIdsToRun = selectedTerminalNodes.map((m) => m.id);
			runNodes(nodeIdsToRun);
		} else {
			runNodes();
		}
	};

	const ButtonLabel = useMemo(() => {
		if (isAnyTaskRunning) {
			if (numberOfTerminalNodes == null || numberOfTerminalNodes === 0) {
				return "Queue Workflow";
			}
			return `Queue ${numberOfTerminalNodes} Node${numberOfTerminalNodes > 1 ? "s" : ""}`;
		}
		if (numberOfTerminalNodes == null || numberOfTerminalNodes === 0) {
			return "Run Workflow";
		}
		return `Run ${numberOfTerminalNodes} Node${numberOfTerminalNodes > 1 ? "s" : ""}`;
	}, [numberOfTerminalNodes, isAnyTaskRunning]);

	return (
		<Button
			variant="default"
			// Disable if no terminal nodes
			disabled={!hasAnyTerminalNode}
			className="rounded-full px-4 gap-2 shadow-sm"
			onClick={handleRunAll}
		>
			{isAnyTaskRunning ? (
				<Loader2 className="w-4 h-4 animate-spin" />
			) : (
				<ForwardIcon className="w-4 h-4" />
			)}
			<span className="text-xs">{ButtonLabel}</span>
		</Button>
	);
});

export { RunWorkflowButton };
