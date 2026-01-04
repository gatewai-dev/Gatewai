import { ForwardIcon } from "lucide-react";
import { memo } from "react";
import { AiOutlineStop } from "react-icons/ai";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { NodeEntityType } from "@/store/nodes";
import { useCanvasCtx } from "../ctx/canvas-ctx";
import { useNodeTaskRunning } from "../ctx/task-manager-ctx";
import { useNodeValidation } from "../processor/processor-ctx";

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
