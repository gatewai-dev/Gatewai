import {
	makeSelectAllEdges,
	makeSelectAllNodes,
	selectSelectedNodes,
	useAppSelector,
	useGetBalanceQuery,
} from "@gatewai/react-store";
import {
	Button,
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@gatewai/ui-kit";
import { Coins, ForwardIcon, Loader2 } from "lucide-react";
import { memo, useMemo } from "react";
import { useCanvasCtx } from "../../canvas-ctx";
import { useNodeRegistry } from "../../node-registry-ctx";
import { useTaskManagerCtx } from "../../task-manager-ctx";

const RENDER_COST = 10;

const VIDEO_AUDIO_OUTPUT_NODE_TYPES = new Set([
	"VideoGen",
	"VideoCompositor",
	"MediaCut",
	"Crop",
	"VideoGenFirstLastFrame",
	"TextToSpeech",
]);

const RunWorkflowButton = memo(() => {
	const { runNodes } = useCanvasCtx();
	const { isAnyTaskRunning } = useTaskManagerCtx();
	const { pricingMap } = useNodeRegistry();

	const selectedNodes = useAppSelector(selectSelectedNodes);
	const nodes = useAppSelector(makeSelectAllNodes);
	const edges = useAppSelector(makeSelectAllEdges);

	const selectedTerminalNodes = selectedNodes?.filter(
		(f) => f.template.isTerminalNode,
	);
	const numberOfTerminalNodes = selectedTerminalNodes?.length;

	const hasAnyTerminalNode = useMemo(
		() => nodes.some((f) => f.template.isTerminalNode),
		[nodes],
	);

	const exportNodesNeedRendering = useMemo(() => {
		const terminalNodes = selectedTerminalNodes?.length
			? selectedTerminalNodes
			: nodes.filter((n) => n.template.isTerminalNode);

		const exportNodes = terminalNodes.filter((n) => n.type === "Export");
		if (exportNodes.length === 0) return false;

		for (const exportNode of exportNodes) {
			const incomingEdges = edges.filter((e) => e.target === exportNode.id);
			for (const edge of incomingEdges) {
				const sourceNode = nodes.find((n) => n.id === edge.source);
				if (sourceNode && VIDEO_AUDIO_OUTPUT_NODE_TYPES.has(sourceNode.type)) {
					return true;
				}
			}
		}
		return false;
	}, [nodes, edges, selectedTerminalNodes]);

	// Calculate total workflow cost (Export node pricing is 0, render cost shown separately)
	const totalCost = useMemo(() => {
		const terminalNodes = selectedTerminalNodes?.length
			? selectedTerminalNodes
			: nodes.filter((n) => n.template.isTerminalNode);
		let cost = 0;
		for (const n of terminalNodes) {
			const pricingFn = pricingMap[n.type];
			if (typeof pricingFn === "function") {
				try {
					cost += pricingFn(n.config ?? {});
				} catch {
					// skip
				}
			}
		}
		return cost;
	}, [selectedTerminalNodes, nodes, pricingMap]);

	const { data: balance } = useGetBalanceQuery(undefined, {
		pollingInterval: 30_000,
	});
	const userTokens = balance?.tokens ?? 0;
	const canAfford = totalCost <= 0 || userTokens >= totalCost;

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

	const button = (
		<Button
			variant="default"
			disabled={!hasAnyTerminalNode || !canAfford}
			className="rounded-full px-4 gap-2 shadow-sm"
			onClick={handleRunAll}
		>
			{isAnyTaskRunning ? (
				<Loader2 className="w-4 h-4 animate-spin" />
			) : (
				<ForwardIcon className="w-4 h-4" />
			)}
			<span className="text-xs">{ButtonLabel}</span>
			{totalCost > 0 && (
				<span className="inline-flex items-center gap-0.5 text-[10px] opacity-70 ml-0.5">
					<Coins className="size-3" />
					{totalCost}
				</span>
			)}
			{exportNodesNeedRendering && (
				<span
					className="inline-flex items-center gap-0.5 text-[10px] text-amber-600 ml-0.5"
					title={`Export render will cost ${RENDER_COST} tokens when downloading`}
				>
					(+{RENDER_COST})
				</span>
			)}
		</Button>
	);

	if (!canAfford && hasAnyTerminalNode) {
		return (
			<Popover>
				<PopoverTrigger asChild>{button}</PopoverTrigger>
				<PopoverContent side="top" className="w-52 p-3 text-xs space-y-2">
					<p className="font-medium">Insufficient Tokens</p>
					<p className="text-muted-foreground">
						This workflow costs {totalCost} tokens but you have {userTokens}.
						Purchase more from the Subscription menu.
					</p>
				</PopoverContent>
			</Popover>
		);
	}

	return button;
});

export { RunWorkflowButton };
