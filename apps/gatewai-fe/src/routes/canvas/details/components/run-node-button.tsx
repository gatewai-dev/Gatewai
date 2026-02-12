import type { NodeEntityType } from "@gatewai/react-store";
import { Button, type ButtonProps, Spinner } from "@gatewai/ui-kit";
import { ForwardIcon } from "lucide-react";
import { memo } from "react";
import { AiOutlineStop } from "react-icons/ai";
import { useCanvasCtx } from "../../../../../../../packages/react-canvas/src/canvas-ctx";
import { useNodeTaskRunning } from "../ctx/task-manager-ctx";
import { useNodeValidation } from "../graph-engine/processor-ctx";

export type RunNodeButtonProps = ButtonProps & {
	nodeId: NodeEntityType["id"];
};

const RunNodeButton = memo(({ nodeId, ...buttonProps }: RunNodeButtonProps) => {
	const { runNodes } = useCanvasCtx();

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
					<AiOutlineStop className="size-3" />
					<span className="text-xs">Invalid Inputs</span>
				</>
			)}
		</Button>
	);
});

export { RunNodeButton };
