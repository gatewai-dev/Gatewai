import type { NodeEntityType } from "@gatewai/react-store";
import {
	makeSelectNodeById,
	useAppSelector,
	useGetBalanceQuery,
} from "@gatewai/react-store";
import {
	Button,
	type ButtonProps,
	Popover,
	PopoverContent,
	PopoverTrigger,
	Spinner,
} from "@gatewai/ui-kit";
import { Coins, ForwardIcon } from "lucide-react";
import { memo, useMemo } from "react";
import {
	useCanvasCtx,
	useNodeTaskRunning,
	useNodeValidation,
} from "../index.js";
import { useNodePricing } from "../node-registry-ctx.js";

export type RunNodeButtonProps = ButtonProps & {
	nodeId: NodeEntityType["id"];
};

const RunNodeButton = memo(({ nodeId, ...buttonProps }: RunNodeButtonProps) => {
	const { runNodes } = useCanvasCtx();

	const isNodeRunning = useNodeTaskRunning(nodeId);
	const validation = useNodeValidation(nodeId);
	const isInvalid = validation && Object.keys(validation).length > 0;

	const selectNode = useMemo(() => makeSelectNodeById(nodeId), [nodeId]);
	const nodeEntity = useAppSelector(selectNode) as NodeEntityType | undefined;
	const cost = useNodePricing(
		(nodeEntity as any)?.type ?? "",
		(nodeEntity as any)?.config ?? {},
	);

	const { data: balance } = useGetBalanceQuery(undefined, {
		pollingInterval: 30_000,
	});
	const userTokens = balance?.tokens ?? 0;
	const canAfford = cost <= 0 || userTokens >= cost;

	const isDisabled = isInvalid || !canAfford;

	const button = (
		<Button
			{...buttonProps}
			disabled={isDisabled}
			onClick={() => runNodes([nodeId])}
			size="sm"
		>
			{!isNodeRunning && !isInvalid && (
				<>
					<ForwardIcon />
					<span className="text-xs">Run Node</span>
					{cost > 0 && (
						<span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground ml-1">
							<Coins className="size-3" />
							{cost}
						</span>
					)}
				</>
			)}
			{isNodeRunning && (
				<>
					<Spinner className="size-3" />
					<span className="text-xs">Queue Node</span>
				</>
			)}
			{isInvalid && (
				<>
					<span className="text-xs">Invalid Inputs</span>
				</>
			)}
		</Button>
	);

	if (!canAfford && !isInvalid) {
		return (
			<Popover>
				<PopoverTrigger asChild>{button}</PopoverTrigger>
				<PopoverContent side="top" className="w-52 p-3 text-xs space-y-2">
					<p className="font-medium">Insufficient Tokens</p>
					<p className="text-muted-foreground">
						You need {cost} tokens but have {userTokens}. Purchase more tokens
						from the Subscription menu.
					</p>
				</PopoverContent>
			</Popover>
		);
	}

	return button;
});

export { RunNodeButton };
