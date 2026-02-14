import type { NodeEntityType } from "@gatewai/react-store";
import { Button, type ButtonProps, Spinner } from "@gatewai/ui-kit";
import { ForwardIcon } from "lucide-react";
import { memo } from "react";
import { useNodeUI } from "../ui.js"; // Explicitly use .js extension for ESM

export type RunNodeButtonProps = ButtonProps & {
	nodeId: NodeEntityType["id"];
};

const RunNodeButton = memo(({ nodeId, ...buttonProps }: RunNodeButtonProps) => {
	const { runNodes, useNodeTaskRunning, useNodeValidation } = useNodeUI();

	const isNodeRunning = useNodeTaskRunning(nodeId);

	const validation = useNodeValidation(nodeId);
	const isInvalid = validation && Object.keys(validation).length > 0;
	return (
		<Button
			{...buttonProps}
			disabled={isNodeRunning || isInvalid}
			onClick={() => runNodes([nodeId])}
			size="sm"
		>
			{!isNodeRunning && !isInvalid && (
				<>
					<ForwardIcon />
					<span className="text-xs">Run Node</span>
				</>
			)}
			{isNodeRunning && (
				<>
					<Spinner className="size-3" />
					<span className="text-xs">Running...</span>
				</>
			)}
			{isInvalid && (
				<>
					<span className="text-xs">Invalid Inputs</span>
				</>
			)}
		</Button>
	);
});

export { RunNodeButton };
