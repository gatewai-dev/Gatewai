import { ForwardIcon } from "lucide-react"; // Added ForwardIcon
import { memo, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { useAppSelector } from "@/store";
import { makeSelectAllNodes, selectSelectedNodes } from "@/store/nodes";
import { useCanvasCtx } from "../../ctx/canvas-ctx";

const RunWorkflowButton = memo(() => {
	const { runNodes } = useCanvasCtx();
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
		}
		runNodes();
	};

	const ButtonLabel = useMemo(() => {
		if (numberOfTerminalNodes == null || numberOfTerminalNodes === 0) {
			return "Run Workflow";
		}
		return `Run ${numberOfTerminalNodes} Node${numberOfTerminalNodes > 1 ? "s" : ""}`;
	}, [numberOfTerminalNodes]);

	return (
		<Button
			variant="default"
			size="sm"
			disabled={!hasAnyTerminalNode}
			className="rounded-full px-4 gap-2 shadow-sm"
			onClick={handleRunAll}
		>
			<ForwardIcon className="w-4 h-4" />
			<span className="text-xs">{ButtonLabel}</span>
		</Button>
	);
});

export { RunWorkflowButton };
